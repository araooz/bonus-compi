/**
 * Grammar Engine — Core CFG Representation
 * 
 * A Context-Free Grammar G = (V, Σ, R, S) where:
 *   V = set of non-terminal symbols (variables)
 *   Σ = set of terminal symbols
 *   R = set of production rules (V → (V ∪ Σ)*)
 *   S = start symbol (first non-terminal defined)
 * 
 * This module parses a text representation of a grammar into a structured
 * internal format that all other engines consume.
 */

export const EPSILON = 'ε';
export const END_MARKER = '$';
export const DOT = '•';

/**
 * Parse a raw grammar string into a structured Grammar object.
 * Supports notations: "E -> E + T | T" or "E → E + T | T"
 * 
 * @param {string} text - Raw grammar text, one rule per line
 * @returns {{ grammar: Grammar|null, errors: string[] }}
 */
export function parseGrammar(text) {
  const errors = [];
  const productions = [];
  const nonTerminals = new Set();
  const allSymbols = new Set();
  let startSymbol = null;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));

  if (lines.length === 0) {
    return { grammar: null, errors: ['No grammar rules provided.'] };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Support both -> and → as arrow notation
    const arrowMatch = line.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
    if (!arrowMatch) {
      errors.push(`Line ${i + 1}: Invalid syntax "${line}". Expected format: "A -> α | β"`);
      continue;
    }

    const lhs = arrowMatch[1].trim();
    const rhsRaw = arrowMatch[2];

    // Validate LHS is a single non-terminal (uppercase letter or multi-char like E')
    if (!isValidNonTerminal(lhs)) {
      errors.push(`Line ${i + 1}: Invalid non-terminal "${lhs}". Use uppercase letters (e.g., E, T, E').`);
      continue;
    }

    if (!startSymbol) startSymbol = lhs;
    nonTerminals.add(lhs);

    // Split alternatives on | but be careful of quoted literals
    const alternatives = splitAlternatives(rhsRaw);

    for (const alt of alternatives) {
      const symbols = tokenizeRHS(alt.trim());
      if (symbols === null) {
        errors.push(`Line ${i + 1}: Could not parse alternative "${alt.trim()}".`);
        continue;
      }
      symbols.forEach(s => { if (s !== EPSILON) allSymbols.add(s); });
      productions.push({ lhs, rhs: symbols });
    }
  }

  if (errors.length > 0) {
    return { grammar: null, errors };
  }

  // Derive terminal set: all symbols that are not non-terminals
  const terminals = new Set();
  for (const sym of allSymbols) {
    if (!nonTerminals.has(sym)) {
      terminals.add(sym);
    }
  }

  // Validate that all non-terminals on RHS are defined
  for (const prod of productions) {
    for (const sym of prod.rhs) {
      if (sym !== EPSILON && isValidNonTerminal(sym) && !nonTerminals.has(sym)) {
        // Treat as non-terminal that wasn't defined — could be an error
        errors.push(`Warning: Non-terminal "${sym}" used but never defined on LHS.`);
        nonTerminals.add(sym);
      }
    }
  }

  const grammar = {
    nonTerminals: Array.from(nonTerminals),
    terminals: Array.from(terminals),
    productions,
    startSymbol,
  };

  return { grammar, errors };
}

/**
 * Check if a string represents a valid non-terminal symbol.
 * Non-terminals: uppercase letters, possibly followed by ' (prime) or digits.
 * Also supports multi-character non-terminals enclosed in angle brackets like <expr>.
 */
export function isValidNonTerminal(s) {
  return /^[A-Z][A-Z0-9']*$/i.test(s) && /^[A-Z]/.test(s);
}

/**
 * Check if a symbol is a non-terminal within a given grammar.
 */
export function isNonTerminal(symbol, grammar) {
  return grammar.nonTerminals.includes(symbol);
}

/**
 * Check if a symbol is a terminal within a given grammar.
 */
export function isTerminal(symbol, grammar) {
  return grammar.terminals.includes(symbol) || symbol === END_MARKER;
}

/**
 * Split RHS of a production on '|' character for alternatives.
 * The pipe must be surrounded by spaces or at string boundaries to count
 * as an alternative separator (avoids confusion with | as a terminal).
 */
function splitAlternatives(rhs) {
  // Split on | that appears as a standalone separator (with surrounding whitespace)
  // This regex splits on | preceded and followed by whitespace or string boundary
  return rhs.split(/\s*\|\s*/).filter(s => s.length > 0);
}

/**
 * Tokenize the right-hand side of a production into individual symbols.
 * Handles: single lowercase chars as terminals, uppercase as non-terminals,
 * multi-char non-terminals with primes (E'), epsilon (ε), and quoted strings.
 */
function tokenizeRHS(rhs) {
  const tokens = [];
  const trimmed = rhs.trim();

  if (trimmed === '' || trimmed === EPSILON || trimmed === 'epsilon' || trimmed === 'eps') {
    return [EPSILON];
  }

  // Tokenize by splitting on spaces primarily, but also handle concatenated symbols
  const parts = trimmed.split(/\s+/);

  for (const part of parts) {
    if (part === EPSILON || part === 'epsilon' || part === 'eps') {
      tokens.push(EPSILON);
    } else if (part === END_MARKER) {
      tokens.push(END_MARKER);
    } else {
      // Parse each part character by character for non-terminal detection
      let i = 0;
      while (i < part.length) {
        if (part[i] >= 'A' && part[i] <= 'Z') {
          // Start of a non-terminal: consume uppercase + optional primes/digits
          let nt = part[i];
          i++;
          while (i < part.length && (part[i] === "'" || (part[i] >= '0' && part[i] <= '9'))) {
            nt += part[i];
            i++;
          }
          tokens.push(nt);
        } else {
          // Terminal symbol: single character (lowercase, digit, operator, etc.)
          tokens.push(part[i]);
          i++;
        }
      }
    }
  }

  return tokens.length > 0 ? tokens : null;
}

/**
 * Get all productions for a given non-terminal.
 */
export function getProductionsFor(grammar, nonTerminal) {
  return grammar.productions.filter(p => p.lhs === nonTerminal);
}

/**
 * Get a numbered list of productions (useful for LR reduce actions).
 */
export function getNumberedProductions(grammar) {
  return grammar.productions.map((p, i) => ({ index: i, ...p }));
}

/**
 * Create an augmented grammar for LR parsing.
 * Adds S' -> S production at the start.
 */
export function augmentGrammar(grammar) {
  const newStart = grammar.startSymbol + "'";
  // Avoid collision if S' already exists
  let augStart = newStart;
  let counter = 1;
  while (grammar.nonTerminals.includes(augStart)) {
    augStart = grammar.startSymbol + "'".repeat(counter + 1);
    counter++;
  }

  return {
    nonTerminals: [augStart, ...grammar.nonTerminals],
    terminals: [...grammar.terminals],
    productions: [
      { lhs: augStart, rhs: [grammar.startSymbol] },
      ...grammar.productions,
    ],
    startSymbol: augStart,
    originalStart: grammar.startSymbol,
  };
}

/**
 * Format a production as a readable string.
 */
export function formatProduction(prod) {
  return `${prod.lhs} → ${prod.rhs.join(' ')}`;
}

/**
 * Tokenize an input string for parsing.
 */
export function tokenizeInput(input, grammar) {
  const tokens = [];
  const trimmed = input.trim();
  if (trimmed === '') return tokens;

  const parts = trimmed.split(/\s+/);
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      tokens.push(part[i]);
    }
  }
  return tokens;
}
