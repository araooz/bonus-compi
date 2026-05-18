/**
 * Recursive Descent Parser Simulator
 * 
 * Simulates the execution stack of a recursive descent parser.
 * Each non-terminal becomes a "function call" and we trace the call stack.
 * This is a top-down parser that tries productions left-to-right.
 * 
 * For ambiguous/left-recursive grammars, we employ backtracking with a depth limit.
 */

import { EPSILON, isNonTerminal, getProductionsFor, formatProduction, tokenizeInput } from './grammar.js';

/**
 * Simulate recursive descent parsing.
 * 
 * @param {Grammar} grammar
 * @param {string} inputStr
 * @returns {{ accepted, steps, error, parseTree }}
 */
export function simulateRecursiveDescent(grammar, inputStr) {
  const input = tokenizeInput(inputStr, grammar);
  const steps = [];
  let stepCount = 0;
  const maxSteps = 5000;
  let treeIdCounter = 0;

  function parse(symbol, pos, depth) {
    if (stepCount >= maxSteps) return null;
    if (depth > 100) return null; // Depth limit to prevent infinite recursion

    stepCount++;

    if (!isNonTerminal(symbol, grammar)) {
      // Terminal: try to match
      if (pos < input.length && input[pos] === symbol) {
        steps.push({
          step: stepCount,
          stack: `${'  '.repeat(depth)}match('${symbol}')`,
          input: input.slice(pos).join(' ') || 'ε',
          action: `Match terminal '${symbol}' ✓`,
        });
        return {
          node: { id: treeIdCounter++, symbol, children: [], terminal: true },
          newPos: pos + 1,
        };
      } else {
        steps.push({
          step: stepCount,
          stack: `${'  '.repeat(depth)}match('${symbol}')`,
          input: input.slice(pos).join(' ') || 'ε',
          action: `Expected '${symbol}', got '${pos < input.length ? input[pos] : 'EOF'}' ✗`,
        });
        return null;
      }
    }

    // Non-terminal: try each production
    const prods = getProductionsFor(grammar, symbol);

    for (const prod of prods) {
      if (stepCount >= maxSteps) return null;
      stepCount++;

      steps.push({
        step: stepCount,
        stack: `${'  '.repeat(depth)}${symbol}()`,
        input: input.slice(pos).join(' ') || 'ε',
        action: `Try ${formatProduction(prod)}`,
      });

      let currentPos = pos;
      const children = [];
      let success = true;

      if (prod.rhs.length === 1 && prod.rhs[0] === EPSILON) {
        // Epsilon production always succeeds
        children.push({ id: treeIdCounter++, symbol: EPSILON, children: [], terminal: true });
        stepCount++;
        steps.push({
          step: stepCount,
          stack: `${'  '.repeat(depth + 1)}ε`,
          input: input.slice(currentPos).join(' ') || 'ε',
          action: 'Epsilon production — skip',
        });
      } else {
        for (const rhsSym of prod.rhs) {
          const result = parse(rhsSym, currentPos, depth + 1);
          if (result === null) {
            success = false;
            break;
          }
          children.push(result.node);
          currentPos = result.newPos;
        }
      }

      if (success) {
        return {
          node: { id: treeIdCounter++, symbol, children },
          newPos: currentPos,
        };
      }
      // Backtrack: try next production
    }

    return null; // All productions failed
  }

  const result = parse(grammar.startSymbol, 0, 0);

  if (result && result.newPos === input.length) {
    steps.push({
      step: stepCount + 1,
      stack: 'DONE',
      input: '',
      action: 'ACCEPT',
    });
    return { accepted: true, steps, error: null, parseTree: result.node };
  }

  if (result && result.newPos < input.length) {
    steps.push({
      step: stepCount + 1,
      stack: 'FAILED',
      input: input.slice(result.newPos).join(' '),
      action: `ERROR: Parsed successfully but input remains: '${input.slice(result.newPos).join(' ')}'`,
    });
    return {
      accepted: false,
      steps,
      error: `Parsed successfully but input remains: '${input.slice(result.newPos).join(' ')}'`,
      parseTree: result ? result.node : null,
    };
  }

  steps.push({
    step: stepCount + 1,
    stack: 'FAILED',
    input: input.join(' '),
    action: 'ERROR: No production sequence matches the input.',
  });

  return {
    accepted: false,
    steps,
    error: 'No production sequence matches the input.',
    parseTree: null,
  };
}
