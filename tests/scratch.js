import { simulateRecursiveDescent } from '../src/engines/recursiveDescent.js';
import { EPSILON } from '../src/engines/grammar.js';

const grammar = {
  startSymbol: 'S',
  productions: [
    { lhs: 'S', rhs: ['[', 'L', ']'] },
    { lhs: 'S', rhs: ['i'] },
    { lhs: 'L', rhs: ['S', "L'"] },
    { lhs: "L'", rhs: [',', 'S', "L'"] },
    { lhs: "L'", rhs: [EPSILON] }
  ],
  nonTerminals: ['S', 'L', "L'"],
  terminals: ['[', ']', 'i', ',']
};

const result = simulateRecursiveDescent(grammar, '[ i , , i ]');
console.log("ACCEPTED:", result.accepted);
console.log("ERROR:", result.error);
console.log("STEPS:");
result.steps.forEach(s => console.log(`Step ${s.step}: ${s.stack} | Input: ${s.input} | Action: ${s.action}`));
