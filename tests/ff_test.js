import { parseGrammar } from '../src/engines/grammar.js';
import { computeFirstSets, computeFollowSets } from '../src/engines/firstFollow.js';

const text = `
S -> [ L ] | i
L -> S L'
L' -> , S L' | ε
`;

const { grammar, errors } = parseGrammar(text);
if (errors.length > 0) {
  console.log("Errors:", errors);
} else {
  const { first } = computeFirstSets(grammar);
  console.log("FIRST:", first);
  
  const { follow } = computeFollowSets(grammar, first);
  console.log("FOLLOW:", follow);
}
