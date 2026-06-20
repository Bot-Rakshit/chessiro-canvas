import { premoveDests } from '../dist/index.js';

function expectIncludes(values, expected, label) {
  for (const value of expected) {
    if (!values.includes(value)) {
      throw new Error(`${label}: expected ${value} in ${JSON.stringify(values)}`);
    }
  }
}

function expectExcludes(values, excluded, label) {
  for (const value of excluded) {
    if (values.includes(value)) {
      throw new Error(`${label}: did not expect ${value} in ${JSON.stringify(values)}`);
    }
  }
}

const queenBlockedByOwnPawn = new Map([
  ['d1', { color: 'w', role: 'q' }],
  ['d2', { color: 'w', role: 'p' }],
  ['d5', { color: 'w', role: 'p' }],
]);

expectIncludes(
  premoveDests('d1', queenBlockedByOwnPawn, 'w'),
  ['d2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'],
  'queen premove through current blockers',
);

const bishopBlockedByOwnPawn = new Map([
  ['c1', { color: 'w', role: 'b' }],
  ['d2', { color: 'w', role: 'p' }],
]);

expectIncludes(
  premoveDests('c1', bishopBlockedByOwnPawn, 'w'),
  ['d2', 'e3', 'f4', 'g5', 'h6'],
  'bishop premove through current blocker',
);

expectExcludes(
  premoveDests('d1', queenBlockedByOwnPawn, 'b'),
  ['d2', 'd3', 'd4'],
  'wrong color cannot premove piece',
);

console.log('premove tests passed');
