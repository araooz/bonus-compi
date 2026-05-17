/**
 * LL(1) Predictive Parser Engine
 * 
 * An LL(1) parser reads input Left-to-right, produces a Leftmost derivation,
 * and uses 1 token of lookahead.
 * 
 * Table Construction:
 *   For each production A → α:
 *     - For each terminal a ∈ FIRST(α), add A → α to M[A, a]
 *     - If ε ∈ FIRST(α), for each terminal b ∈ FOLLOW(A), add A → α to M[A, b]
 *     - If ε ∈ FIRST(α) and $ ∈ FOLLOW(A), add A → α to M[A, $]
 * 
 * Conflict: If M[A, a] has more than one production, the grammar is not LL(1).
 */

import { EPSILON, END_MARKER, isNonTerminal, formatProduction, tokenizeInput } from './grammar.js';
import { computeFirstOfSequence } from './firstFollow.js';

/**
 * Build the LL(1) parsing table.
 * 
 * @param {Grammar} grammar
 * @param {Map} first - FIRST sets
 * @param {Map} follow - FOLLOW sets
 * @returns {{ table, conflicts, trace }}
 */
export function buildLL1Table(grammar, first, follow) {
  // Table is a 2D map: table[nonTerminal][terminal] = [productions]
  const table = {};
  const conflicts = [];
  const trace = [];

  // Initialize empty table
  const columnSymbols = [...grammar.terminals, END_MARKER];
  for (const nt of grammar.nonTerminals) {
    table[nt] = {};
    for (const t of columnSymbols) {
      table[nt][t] = [];
    }
  }

  // Fill the table using the LL(1) construction algorithm
  for (let i = 0; i < grammar.productions.length; i++) {
    const prod = grammar.productions[i];
    const { lhs, rhs } = prod;
    const prodStr = formatProduction(prod);
    const prodIndex = i;

    // Compute FIRST(rhs)
    const firstRHS = computeFirstOfSequence(rhs, first, grammar);

    const stepInfo = {
      production: prodStr,
      index: prodIndex,
      firstOfRHS: [...firstRHS],
      entries: [],
    };

    // Rule 1: For each terminal a ∈ FIRST(α), add to M[A, a]
    for (const a of firstRHS) {
      if (a !== EPSILON) {
        table[lhs][a].push({ prodIndex, production: prod });
        stepInfo.entries.push({ row: lhs, col: a, reason: `${a} ∈ FIRST(${rhs.join(' ')})` });
      }
    }

    // Rule 2: If ε ∈ FIRST(α), add to M[A, b] for each b ∈ FOLLOW(A)
    if (firstRHS.has(EPSILON)) {
      const followA = follow.get(lhs);
      for (const b of followA) {
        table[lhs][b].push({ prodIndex, production: prod });
        stepInfo.entries.push({ row: lhs, col: b, reason: `ε ∈ FIRST(${rhs.join(' ')}), ${b} ∈ FOLLOW(${lhs})` });
      }
    }

    trace.push(stepInfo);
  }

  // Detect conflicts (multiply-defined entries)
  for (const nt of grammar.nonTerminals) {
    for (const t of columnSymbols) {
      if (table[nt][t].length > 1) {
        conflicts.push({
          nonTerminal: nt,
          terminal: t,
          productions: table[nt][t].map(e => formatProduction(e.production)),
          message: `Conflict at M[${nt}, ${t}]: multiple productions ${table[nt][t].map(e => formatProduction(e.production)).join(', ')}`,
        });
      }
    }
  }

  return { table, conflicts, trace, columnSymbols };
}

/**
 * Simulate LL(1) parsing of an input string.
 * 
 * Algorithm:
 *   1. Push $ then S onto the stack.
 *   2. While stack is not empty:
 *     a. Let X = top of stack, a = current input symbol.
 *     b. If X = a = $, ACCEPT.
 *     c. If X = a (terminal match), pop and advance input.
 *     d. If X is non-terminal, look up M[X, a]:
 *        - If M[X, a] = X → Y1 Y2 ... Yk, pop X and push Yk...Y1 (reversed).
 *        - If M[X, a] is empty, ERROR.
 * 
 * @returns {{ accepted, steps, error, parseTree }}
 */
export function simulateLL1(grammar, table, inputStr) {
  const input = tokenizeInput(inputStr, grammar);
  input.push(END_MARKER);

  const stack = [END_MARKER, grammar.startSymbol];
  const steps = [];
  let inputPos = 0;
  let stepCount = 0;
  const maxSteps = 10000;

  // Build parse tree
  let treeIdCounter = 0;
  const treeRoot = { id: treeIdCounter++, symbol: grammar.startSymbol, children: [] };
  const treeStack = [null, treeRoot]; // mirrors the parse stack

  while (stack.length > 0 && stepCount < maxSteps) {
    stepCount++;
    const top = stack[stack.length - 1];
    const currentInput = input[inputPos];
    const remainingInput = input.slice(inputPos).join(' ');
    const stackStr = [...stack].join(' ');

    if (top === END_MARKER && currentInput === END_MARKER) {
      steps.push({
        step: stepCount,
        stack: stackStr,
        input: remainingInput,
        action: 'ACCEPT',
      });
      return { accepted: true, steps, error: null, parseTree: treeRoot };
    }

    if (top === currentInput) {
      // Terminal match
      steps.push({
        step: stepCount,
        stack: stackStr,
        input: remainingInput,
        action: `Match '${top}'`,
      });
      stack.pop();
      const treeNode = treeStack.pop();
      if (treeNode) treeNode.terminal = true;
      inputPos++;
      continue;
    }

    if (!isNonTerminal(top, grammar)) {
      steps.push({
        step: stepCount,
        stack: stackStr,
        input: remainingInput,
        action: `ERROR: Expected '${top}', found '${currentInput}'`,
      });
      return {
        accepted: false,
        steps,
        error: `Mismatch: expected '${top}' but found '${currentInput}' at position ${inputPos}`,
        parseTree: treeRoot,
      };
    }

    // Non-terminal: look up table
    const entries = table[top] && table[top][currentInput];
    if (!entries || entries.length === 0) {
      steps.push({
        step: stepCount,
        stack: stackStr,
        input: remainingInput,
        action: `ERROR: No entry in M[${top}, ${currentInput}]`,
      });
      return {
        accepted: false,
        steps,
        error: `No entry in parsing table for M[${top}, ${currentInput}]`,
        parseTree: treeRoot,
      };
    }

    // Use first entry (if conflicts exist, we just pick the first one)
    const entry = entries[0];
    const prod = entry.production;
    const prodStr = formatProduction(prod);

    steps.push({
      step: stepCount,
      stack: stackStr,
      input: remainingInput,
      action: `Output ${prodStr}`,
    });

    // Pop non-terminal
    stack.pop();
    const parentNode = treeStack.pop();

    // Push RHS symbols in reverse order (so leftmost is on top)
    if (!(prod.rhs.length === 1 && prod.rhs[0] === EPSILON)) {
      const childNodes = prod.rhs.map(sym => ({
        id: treeIdCounter++,
        symbol: sym,
        children: [],
      }));

      if (parentNode) parentNode.children = childNodes;

      for (let i = prod.rhs.length - 1; i >= 0; i--) {
        stack.push(prod.rhs[i]);
        treeStack.push(childNodes[i]);
      }
    } else {
      // Epsilon production
      const epsilonNode = { id: treeIdCounter++, symbol: EPSILON, children: [], terminal: true };
      if (parentNode) parentNode.children = [epsilonNode];
    }
  }

  return {
    accepted: false,
    steps,
    error: 'Maximum steps exceeded — possible infinite loop.',
    parseTree: treeRoot,
  };
}
