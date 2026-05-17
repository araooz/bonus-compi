/**
 * FIRST & FOLLOW Set Computation Engine
 * 
 * FIRST(α): The set of terminals that can begin strings derived from α.
 *   - If α =>* ε, then ε ∈ FIRST(α).
 *   - Algorithm uses a fixed-point iteration: keep adding terminals
 *     until no set changes.
 * 
 * FOLLOW(A): The set of terminals that can appear immediately to the right
 * of A in some sentential form.
 *   - $ ∈ FOLLOW(S) where S is the start symbol.
 *   - For each production B → αAβ: FIRST(β) \ {ε} ⊆ FOLLOW(A)
 *   - If ε ∈ FIRST(β) or β is empty: FOLLOW(B) ⊆ FOLLOW(A)
 */

import { EPSILON, END_MARKER, isNonTerminal, getProductionsFor } from './grammar.js';

/**
 * Compute FIRST sets for all symbols in the grammar.
 * Returns a Map: symbol → Set of terminals (including ε).
 * Also returns step-by-step trace of computation.
 */
export function computeFirstSets(grammar) {
  const first = new Map();
  const trace = [];

  // Initialize FIRST sets
  // For terminals, FIRST(a) = {a}
  for (const t of grammar.terminals) {
    first.set(t, new Set([t]));
  }
  // For non-terminals, FIRST(A) = {} initially
  for (const nt of grammar.nonTerminals) {
    first.set(nt, new Set());
  }

  trace.push({ step: 'init', description: 'Initialize FIRST sets: terminals map to themselves, non-terminals start empty.' });

  // Fixed-point iteration
  let changed = true;
  let iteration = 0;
  while (changed) {
    changed = false;
    iteration++;
    const iterChanges = [];

    for (const prod of grammar.productions) {
      const { lhs, rhs } = prod;
      const before = new Set(first.get(lhs));

      // Compute FIRST of the RHS sequence
      const rhsFirst = computeFirstOfSequence(rhs, first, grammar);

      // Add all elements from FIRST(rhs) to FIRST(lhs)
      for (const sym of rhsFirst) {
        if (!first.get(lhs).has(sym)) {
          first.get(lhs).add(sym);
          changed = true;
        }
      }

      const after = first.get(lhs);
      if (after.size > before.size) {
        const added = [...after].filter(x => !before.has(x));
        iterChanges.push({
          production: `${lhs} → ${rhs.join(' ')}`,
          added: added,
          result: [...after],
        });
      }
    }

    if (iterChanges.length > 0) {
      trace.push({
        step: `iteration-${iteration}`,
        description: `Iteration ${iteration}: Process all productions`,
        changes: iterChanges,
      });
    }
  }

  return { first, trace };
}

/**
 * Compute FIRST of a sequence of symbols (e.g., FIRST(X1 X2 ... Xn)).
 * 
 * The key insight: if X1 can derive ε, then we also need terminals
 * from X2's FIRST set, and so on recursively.
 */
export function computeFirstOfSequence(symbols, first, grammar) {
  const result = new Set();

  if (symbols.length === 0 || (symbols.length === 1 && symbols[0] === EPSILON)) {
    result.add(EPSILON);
    return result;
  }

  let allCanBeEmpty = true;

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];

    if (sym === EPSILON) {
      continue;
    }

    const symFirst = first.get(sym);
    if (!symFirst) {
      // Unknown symbol, treat as terminal
      result.add(sym);
      allCanBeEmpty = false;
      break;
    }

    // Add all non-ε symbols from FIRST(sym)
    for (const t of symFirst) {
      if (t !== EPSILON) {
        result.add(t);
      }
    }

    // If ε ∉ FIRST(sym), stop here — the sequence can't "skip" this symbol
    if (!symFirst.has(EPSILON)) {
      allCanBeEmpty = false;
      break;
    }
  }

  // If every symbol in the sequence can derive ε, then ε ∈ FIRST(sequence)
  if (allCanBeEmpty) {
    result.add(EPSILON);
  }

  return result;
}

/**
 * Compute FOLLOW sets for all non-terminals.
 * Returns a Map: non-terminal → Set of terminals (including $).
 * Also returns step-by-step trace.
 */
export function computeFollowSets(grammar, first) {
  const follow = new Map();
  const trace = [];

  // Initialize FOLLOW sets
  for (const nt of grammar.nonTerminals) {
    follow.set(nt, new Set());
  }

  // Rule 1: $ ∈ FOLLOW(S) where S is the start symbol
  follow.get(grammar.startSymbol).add(END_MARKER);
  trace.push({
    step: 'init',
    description: `Rule 1: Add $ to FOLLOW(${grammar.startSymbol}) since it is the start symbol.`,
  });

  // Fixed-point iteration
  let changed = true;
  let iteration = 0;
  while (changed) {
    changed = false;
    iteration++;
    const iterChanges = [];

    for (const prod of grammar.productions) {
      const { lhs, rhs } = prod;

      for (let i = 0; i < rhs.length; i++) {
        const B = rhs[i];
        if (!isNonTerminal(B, grammar)) continue;

        const before = new Set(follow.get(B));

        // Rule 2: For A → αBβ, add FIRST(β) \ {ε} to FOLLOW(B)
        const beta = rhs.slice(i + 1);
        if (beta.length > 0) {
          const firstBeta = computeFirstOfSequence(beta, first, grammar);
          for (const sym of firstBeta) {
            if (sym !== EPSILON && !follow.get(B).has(sym)) {
              follow.get(B).add(sym);
              changed = true;
            }
          }

          // Rule 3: If ε ∈ FIRST(β), add FOLLOW(A) to FOLLOW(B)
          if (firstBeta.has(EPSILON)) {
            for (const sym of follow.get(lhs)) {
              if (!follow.get(B).has(sym)) {
                follow.get(B).add(sym);
                changed = true;
              }
            }
          }
        } else {
          // Rule 3: β is empty → A → αB, add FOLLOW(A) to FOLLOW(B)
          for (const sym of follow.get(lhs)) {
            if (!follow.get(B).has(sym)) {
              follow.get(B).add(sym);
              changed = true;
            }
          }
        }

        const after = follow.get(B);
        if (after.size > before.size) {
          const added = [...after].filter(x => !before.has(x));
          iterChanges.push({
            nonTerminal: B,
            production: `${lhs} → ${rhs.join(' ')}`,
            added,
            result: [...after],
          });
        }
      }
    }

    if (iterChanges.length > 0) {
      trace.push({
        step: `iteration-${iteration}`,
        description: `Iteration ${iteration}: Apply Rules 2 and 3 to all productions`,
        changes: iterChanges,
      });
    }
  }

  return { follow, trace };
}
