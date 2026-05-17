/**
 * LR Parser Engine — Unified Factory for LR(0), SLR(1), LALR(1), and LR(1)
 * 
 * LR parsers read input Left-to-right and produce a Rightmost derivation (in reverse).
 * They work by building a DFA of "item sets" and using that to construct ACTION/GOTO tables.
 * 
 * An LR item is a production with a position marker (dot):
 *   [A → α • β]  means we've seen α and expect to see β.
 * 
 * LR(0) items: No lookahead.
 * LR(1) items: Includes a lookahead terminal [A → α • β, a].
 * SLR(1): Uses LR(0) items but resolves with FOLLOW sets.
 * LALR(1): Merges LR(1) states with same core, unions lookaheads.
 * 
 * Closure Operation:
 *   For [A → α • Bβ, a], add [B → • γ, b] for each B → γ and b ∈ FIRST(βa).
 * 
 * GOTO Operation:
 *   GOTO(I, X) = closure({ [A → αX • β, a] | [A → α • Xβ, a] ∈ I })
 */

import { EPSILON, END_MARKER, DOT, isNonTerminal, formatProduction, augmentGrammar, tokenizeInput } from './grammar.js';
import { computeFirstSets, computeFollowSets, computeFirstOfSequence } from './firstFollow.js';

/**
 * Represent an LR item as a serializable object.
 */
function createItem(prodIndex, dotPos, lookahead = null) {
  return { prodIndex, dotPos, lookahead };
}

function itemKey(item) {
  return `${item.prodIndex}:${item.dotPos}:${item.lookahead || ''}`;
}

function itemCoreKey(item) {
  return `${item.prodIndex}:${item.dotPos}`;
}

function stateKey(items) {
  return items.map(itemKey).sort().join('|');
}

function stateCoreKey(items) {
  return items.map(itemCoreKey).sort().join('|');
}

/**
 * Compute the CLOSURE of a set of LR(1) items.
 * For LR(0), we ignore lookaheads.
 */
function closure(items, grammar, first, isLR1) {
  const result = [...items];
  const seen = new Set(result.map(itemKey));
  const queue = [...result];

  while (queue.length > 0) {
    const item = queue.shift();
    const prod = grammar.productions[item.prodIndex];
    const { rhs } = prod;

    // If dot is before a non-terminal B
    if (item.dotPos < rhs.length && rhs[item.dotPos] !== EPSILON) {
      const B = rhs[item.dotPos];
      if (!isNonTerminal(B, grammar)) continue;

      // For each production B → γ
      for (let j = 0; j < grammar.productions.length; j++) {
        if (grammar.productions[j].lhs !== B) continue;

        if (isLR1) {
          // LR(1): compute lookaheads from FIRST(βa)
          // β = symbols after B in current production
          const beta = rhs.slice(item.dotPos + 1);
          const betaA = [...beta, item.lookahead];
          const firstBetaA = computeFirstOfSequence(betaA, first, grammar);

          for (const la of firstBetaA) {
            if (la === EPSILON) continue;
            const newItem = createItem(j, 0, la);
            const key = itemKey(newItem);
            if (!seen.has(key)) {
              seen.add(key);
              result.push(newItem);
              queue.push(newItem);
            }
          }
        } else {
          // LR(0): no lookahead
          const newItem = createItem(j, 0, null);
          const key = itemKey(newItem);
          if (!seen.has(key)) {
            seen.add(key);
            result.push(newItem);
            queue.push(newItem);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Compute GOTO(I, X) = closure of items with dot advanced past X.
 */
function gotoSet(items, symbol, grammar, first, isLR1) {
  const moved = [];
  for (const item of items) {
    const prod = grammar.productions[item.prodIndex];
    const { rhs } = prod;

    if (item.dotPos < rhs.length && rhs[item.dotPos] === symbol) {
      moved.push(createItem(item.prodIndex, item.dotPos + 1, item.lookahead));
    }
  }
  return moved.length > 0 ? closure(moved, grammar, first, isLR1) : [];
}

/**
 * Build the canonical collection of item sets (the LR automaton states).
 * 
 * @param {Grammar} augGrammar - Augmented grammar
 * @param {Map} first - FIRST sets
 * @param {string} method - 'lr0', 'slr1', 'lalr1', or 'lr1'
 * @returns {{ states, transitions, trace }}
 */
export function buildItemSets(augGrammar, first, method) {
  const isLR1 = method === 'lr1' || method === 'lalr1';
  const trace = [];

  // Initial item: [S' → • S, $] for LR(1), [S' → • S] for LR(0)
  const initialItem = createItem(0, 0, isLR1 ? END_MARKER : null);
  const I0 = closure([initialItem], augGrammar, first, isLR1);

  const states = [I0];
  const stateKeys = new Map();
  const keyFn = (method === 'lalr1') ? stateCoreKey : stateKey;
  stateKeys.set(keyFn(I0), 0);

  const transitions = []; // { from, to, symbol }
  const queue = [0];

  trace.push({
    step: 'init',
    description: `Initial state I₀ computed with closure of [${augGrammar.startSymbol} → • ${augGrammar.productions[0].rhs.join(' ')}${isLR1 ? ', $' : ''}]`,
    state: 0,
    items: formatItems(I0, augGrammar),
  });

  const allSymbols = [...augGrammar.nonTerminals, ...augGrammar.terminals];

  while (queue.length > 0) {
    const stateIdx = queue.shift();
    const stateItems = states[stateIdx];

    for (const X of allSymbols) {
      const nextItems = gotoSet(stateItems, X, augGrammar, first, isLR1);
      if (nextItems.length === 0) continue;

      const key = keyFn(nextItems);
      let targetState;

      if (stateKeys.has(key)) {
        targetState = stateKeys.get(key);

        // For LALR(1): merge lookaheads into existing state
        if (method === 'lalr1') {
          let merged = false;
          for (const newItem of nextItems) {
            const existing = states[targetState].find(
              it => it.prodIndex === newItem.prodIndex && it.dotPos === newItem.dotPos
            );
            if (existing && existing.lookahead !== newItem.lookahead) {
              // Check if this lookahead already exists
              const existingWithLA = states[targetState].find(
                it => it.prodIndex === newItem.prodIndex && it.dotPos === newItem.dotPos && it.lookahead === newItem.lookahead
              );
              if (!existingWithLA) {
                states[targetState].push(newItem);
                merged = true;
              }
            }
          }
          if (merged) {
            // Re-process this state since lookaheads changed
            if (!queue.includes(targetState)) {
              queue.push(targetState);
            }
          }
        }
      } else {
        targetState = states.length;
        states.push(nextItems);
        stateKeys.set(key, targetState);
        queue.push(targetState);

        trace.push({
          step: `goto`,
          description: `GOTO(I${stateIdx}, ${X}) = I${targetState}`,
          state: targetState,
          items: formatItems(nextItems, augGrammar),
        });
      }

      transitions.push({ from: stateIdx, to: targetState, symbol: X });
    }
  }

  return { states, transitions, trace };
}

/**
 * Build ACTION and GOTO tables from item sets.
 * 
 * ACTION table entries:
 *   - Shift s_j: if [A → α • aβ] ∈ I_i and GOTO(I_i, a) = I_j
 *   - Reduce r_k: (depends on method)
 *     * LR(0): if [A → α •] ∈ I_i, reduce for ALL terminals
 *     * SLR(1): if [A → α •] ∈ I_i, reduce for a ∈ FOLLOW(A)
 *     * LR(1)/LALR(1): if [A → α •, a] ∈ I_i, reduce for terminal a
 *   - Accept: if [S' → S •] ∈ I_i
 * 
 * GOTO table: GOTO[i, A] = j if GOTO(I_i, A) = I_j (for non-terminals A)
 */
export function buildParsingTables(augGrammar, states, transitions, follow, method) {
  const actionTable = {};
  const gotoTable = {};
  const conflicts = [];

  const numStates = states.length;
  const terminals = [...augGrammar.terminals, END_MARKER];

  // Initialize tables
  for (let i = 0; i < numStates; i++) {
    actionTable[i] = {};
    gotoTable[i] = {};
    for (const t of terminals) actionTable[i][t] = [];
    for (const nt of augGrammar.nonTerminals) gotoTable[i][nt] = null;
  }

  // Fill GOTO table from transitions (non-terminal transitions)
  for (const trans of transitions) {
    if (isNonTerminal(trans.symbol, augGrammar)) {
      gotoTable[trans.from][trans.symbol] = trans.to;
    }
  }

  // Fill ACTION table
  for (let i = 0; i < numStates; i++) {
    const stateItems = states[i];

    for (const item of stateItems) {
      const prod = augGrammar.productions[item.prodIndex];
      const { lhs, rhs } = prod;

      if (item.dotPos < rhs.length && rhs[item.dotPos] !== EPSILON) {
        // Dot is before a terminal → SHIFT
        const nextSym = rhs[item.dotPos];
        if (!isNonTerminal(nextSym, augGrammar)) {
          const target = transitions.find(t => t.from === i && t.symbol === nextSym);
          if (target) {
            addAction(actionTable, i, nextSym, { type: 'shift', state: target.to }, conflicts);
          }
        }
      } else {
        // Dot is at the end (or epsilon production) → REDUCE or ACCEPT
        const isEpsilonProd = rhs.length === 1 && rhs[0] === EPSILON;
        const dotAtEnd = item.dotPos >= rhs.length || isEpsilonProd;

        if (dotAtEnd) {
          if (item.prodIndex === 0) {
            // Accept: S' → S •
            addAction(actionTable, i, END_MARKER, { type: 'accept' }, conflicts);
          } else {
            // Reduce
            const reduceTerminals = getReduceTerminals(item, lhs, augGrammar, follow, method);
            for (const t of reduceTerminals) {
              addAction(actionTable, i, t, { type: 'reduce', prodIndex: item.prodIndex, production: prod }, conflicts);
            }
          }
        }
      }
    }
  }

  return { actionTable, gotoTable, conflicts };
}

function getReduceTerminals(item, lhs, grammar, follow, method) {
  switch (method) {
    case 'lr0':
      // Reduce on all terminals + $
      return [...grammar.terminals, END_MARKER];
    case 'slr1':
      // Reduce only on FOLLOW(lhs)
      return [...(follow.get(lhs) || [])];
    case 'lr1':
    case 'lalr1':
      // Reduce only on the specific lookahead
      return [item.lookahead];
    default:
      return [...grammar.terminals, END_MARKER];
  }
}

function addAction(table, state, symbol, action, conflicts) {
  const existing = table[state][symbol];
  if (!existing) {
    table[state][symbol] = [action];
    return;
  }

  // Check for conflicts
  const isDuplicate = existing.some(a =>
    a.type === action.type &&
    a.state === action.state &&
    a.prodIndex === action.prodIndex
  );
  if (!isDuplicate) {
    existing.push(action);
    if (existing.length > 1) {
      const types = existing.map(a => a.type);
      let conflictType;
      if (types.includes('shift') && types.includes('reduce')) {
        conflictType = 'Shift/Reduce';
      } else {
        conflictType = 'Reduce/Reduce';
      }
      // Only add if not already reported
      const alreadyReported = conflicts.some(c => c.state === state && c.symbol === symbol);
      if (!alreadyReported) {
        conflicts.push({
          state,
          symbol,
          type: conflictType,
          actions: existing.map(formatAction),
          message: `${conflictType} conflict in state ${state} on '${symbol}'`,
        });
      }
    }
  }
}

function formatAction(action) {
  if (action.type === 'shift') return `s${action.state}`;
  if (action.type === 'reduce') return `r${action.prodIndex}`;
  if (action.type === 'accept') return 'acc';
  return '?';
}

/**
 * Format items for display.
 */
function formatItems(items, grammar) {
  return items.map(item => {
    const prod = grammar.productions[item.prodIndex];
    const rhs = prod.rhs[0] === EPSILON ? [] : [...prod.rhs];
    const before = rhs.slice(0, item.dotPos).join(' ');
    const after = rhs.slice(item.dotPos).join(' ');
    const dotted = `${prod.lhs} → ${before} ${DOT} ${after}`.trim();
    return item.lookahead ? `[${dotted}, ${item.lookahead}]` : `[${dotted}]`;
  });
}

/**
 * Run the complete LR analysis pipeline.
 * 
 * @param {Grammar} grammar - Original (non-augmented) grammar
 * @param {string} method - 'lr0', 'slr1', 'lalr1', or 'lr1'
 * @returns {{ augGrammar, states, transitions, actionTable, gotoTable, conflicts, first, follow, trace }}
 */
export function buildLRParser(grammar, method) {
  try {
    const augGrammar = augmentGrammar(grammar);
    const { first } = computeFirstSets(augGrammar);
    const { follow } = computeFollowSets(augGrammar, first);
    const { states, transitions, trace: itemTrace } = buildItemSets(augGrammar, first, method);
    const { actionTable, gotoTable, conflicts } = buildParsingTables(augGrammar, states, transitions, follow, method);

    return {
      augGrammar,
      states: states.map((s, i) => ({
        index: i,
        items: formatItems(s, augGrammar),
        rawItems: s,
      })),
      transitions,
      actionTable,
      gotoTable,
      conflicts,
      first,
      follow,
      trace: itemTrace,
      error: null,
    };
  } catch (e) {
    return {
      augGrammar: null,
      states: [],
      transitions: [],
      actionTable: {},
      gotoTable: {},
      conflicts: [],
      first: null,
      follow: null,
      trace: [],
      error: `LR(${method}) analysis failed: ${e.message}`,
    };
  }
}

/**
 * Simulate LR parsing of an input string.
 * 
 * Algorithm:
 *   1. Initialize stack with state 0.
 *   2. Repeat:
 *     a. Let s = top state, a = current input.
 *     b. If ACTION[s, a] = shift t: push a, push t, advance input.
 *     c. If ACTION[s, a] = reduce A → β: pop 2*|β| symbols,
 *        let t = new top state, push A, push GOTO[t, A].
 *     d. If ACTION[s, a] = accept: done!
 *     e. If ACTION[s, a] = error: report.
 */
export function simulateLR(augGrammar, actionTable, gotoTable, inputStr, originalGrammar) {
  const grammar = originalGrammar || augGrammar;
  const input = tokenizeInput(inputStr, grammar);
  input.push(END_MARKER);

  const stack = [0]; // Stack alternates: state, symbol, state, symbol, ...
  const symbolStack = []; // Parallel symbol stack for readability
  const steps = [];
  let inputPos = 0;
  let stepCount = 0;
  const maxSteps = 10000;

  // For parse tree construction
  const treeStack = [];
  let treeIdCounter = 0;

  while (stepCount < maxSteps) {
    stepCount++;
    const state = stack[stack.length - 1];
    const currentInput = input[inputPos];
    const stackDisplay = formatLRStack(stack, symbolStack);
    const remainingInput = input.slice(inputPos).join(' ');

    const actions = actionTable[state] && actionTable[state][currentInput];
    if (!actions || actions.length === 0) {
      steps.push({
        step: stepCount,
        stack: stackDisplay,
        input: remainingInput,
        action: `ERROR: No action for state ${state}, input '${currentInput}'`,
      });
      return {
        accepted: false,
        steps,
        error: `Parse error at position ${inputPos}: no action for state ${state} on '${currentInput}'`,
        parseTree: treeStack.length > 0 ? treeStack[0] : null,
      };
    }

    const action = actions[0]; // Use first action (prefer shift in S/R conflicts)

    if (action.type === 'shift') {
      steps.push({
        step: stepCount,
        stack: stackDisplay,
        input: remainingInput,
        action: `Shift → state ${action.state}`,
      });
      symbolStack.push(currentInput);
      stack.push(action.state);
      treeStack.push({ id: treeIdCounter++, symbol: currentInput, children: [], terminal: true });
      inputPos++;
    } else if (action.type === 'reduce') {
      const prod = action.production;
      const rhsLen = (prod.rhs.length === 1 && prod.rhs[0] === EPSILON) ? 0 : prod.rhs.length;

      steps.push({
        step: stepCount,
        stack: stackDisplay,
        input: remainingInput,
        action: `Reduce by ${formatProduction(prod)} (r${action.prodIndex})`,
      });

      // Build tree node
      const children = treeStack.splice(-rhsLen, rhsLen);
      const treeNode = { id: treeIdCounter++, symbol: prod.lhs, children };

      // Pop 2 * |β| from stack (state for each symbol)
      for (let i = 0; i < rhsLen; i++) {
        stack.pop();
        symbolStack.pop();
      }

      const topState = stack[stack.length - 1];
      const gotoState = gotoTable[topState] && gotoTable[topState][prod.lhs];

      if (gotoState === null || gotoState === undefined) {
        steps.push({
          step: stepCount + 1,
          stack: formatLRStack(stack, symbolStack),
          input: remainingInput,
          action: `ERROR: No GOTO for state ${topState}, non-terminal '${prod.lhs}'`,
        });
        return {
          accepted: false,
          steps,
          error: `GOTO error: no entry for state ${topState} on '${prod.lhs}'`,
          parseTree: treeNode,
        };
      }

      symbolStack.push(prod.lhs);
      stack.push(gotoState);
      treeStack.push(treeNode);
    } else if (action.type === 'accept') {
      steps.push({
        step: stepCount,
        stack: stackDisplay,
        input: remainingInput,
        action: 'ACCEPT',
      });
      return {
        accepted: true,
        steps,
        error: null,
        parseTree: treeStack.length > 0 ? treeStack[0] : null,
      };
    }
  }

  return {
    accepted: false,
    steps,
    error: 'Maximum steps exceeded.',
    parseTree: treeStack.length > 0 ? treeStack[0] : null,
  };
}

function formatLRStack(stateStack, symbolStack) {
  let result = `${stateStack[0]}`;
  for (let i = 0; i < symbolStack.length; i++) {
    result += ` ${symbolStack[i]} ${stateStack[i + 1]}`;
  }
  return result;
}

/**
 * Compute a simplified AST from a parse tree.
 * Removes non-terminal nodes that have a single child (chain rules),
 * keeping only structurally meaningful nodes.
 */
export function computeAST(parseTree) {
  if (!parseTree) return null;

  function simplify(node) {
    if (node.terminal || node.children.length === 0) {
      return { ...node, children: [] };
    }

    const simplifiedChildren = node.children
      .map(simplify)
      .filter(c => c.symbol !== EPSILON);

    // If a non-terminal has exactly one child, collapse it (chain rule elimination)
    if (simplifiedChildren.length === 1 && !node.terminal) {
      return simplifiedChildren[0];
    }

    return { ...node, children: simplifiedChildren };
  }

  return simplify(parseTree);
}
