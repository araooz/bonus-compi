/**
 * Preset Grammars — Classic examples for fast demonstration.
 */

export const presetGrammars = [
  {
    name: 'Simple Expression (LL(1) compatible)',
    description: 'A classic expression grammar already in LL(1) form with left-recursion eliminated.',
    grammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | i`,
    testInput: 'i + i * i',
  },
  {
    name: 'Expression (Left-Recursive)',
    description: 'Standard expression grammar with left recursion — NOT LL(1), but works with LR parsers.',
    grammar: `E → E + T | T
T → T * F | F
F → ( E ) | i`,
    testInput: 'i + i * i',
  },
  {
    name: 'Ambiguous If-Else (Dangling Else)',
    description: 'The classic dangling-else ambiguity. Causes shift/reduce conflicts in LR parsers.',
    grammar: `S → i E t S S' | a
S' → e S | ε
E → b`,
    testInput: 'i b t a e a',
  },
  {
    name: 'Balanced Parentheses',
    description: 'A simple grammar for matched parentheses — useful for basic demonstrations.',
    grammar: `S → ( S ) S | ε`,
    testInput: '( ( ) ) ( )',
  },
  {
    name: 'Simple Arithmetic (SLR(1))',
    description: 'A compact arithmetic grammar suitable for SLR(1) parsing.',
    grammar: `E → E + T | T
T → T * F | F
F → ( E ) | n`,
    testInput: 'n + n * n',
  },
];
