export const presetGrammars = [
  {
    name: 'Expresión Simple (Compatible con LL(1))',
    description: 'ya en forma LL(1) con la recursividad por la izquierda eliminada.',
    grammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | i`,
    testInput: 'i + i * i',
  },
  {
    name: 'Expresión (Recursiva por la izquierda)',
    description: 'con recursividad por la izquierda — NO es LL(1), pero funciona con parsers LR.',
    grammar: `E → E + T | T
T → T * F | F
F → ( E ) | i`,
    testInput: 'i + i * i',
  },
  {
    name: 'If-Else Ambiguo (Else colgante)',
    description: 'Causa conflictos de desplazamiento/reducción en los parsers LR.',
    grammar: `S → i E t S S' | a
S' → e S | ε
E → b`,
    testInput: 'i b t a e a',
  },
  {
    name: 'Paréntesis Balanceados',
    description: 'emparejar parentesis.',
    grammar: `S → ( S ) S | ε`,
    testInput: '( ( ) ) ( )',
  },
  {
    name: 'Aritmética Simple (SLR(1))',
    description: 'aritmetica simple para analisis SLR(1).',
    grammar: `E → E + T | T
T → T * F | F
F → ( E ) | n`,
    testInput: 'n + n * n',
  },
];
