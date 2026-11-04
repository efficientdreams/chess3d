import { Chess, sqName } from '../src/chess/engine.js';
import { findBestMove } from '../src/chess/ai.js';
const show = (r) => r && sqName(r.from) + sqName(r.to) + (r.promotion || '');
for (const lvl of [1,2,3,4]) {
  const t = performance.now();
  const r = findBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', null, lvl);
  console.log('lvl', lvl, show(r), r.nodes, Math.round(performance.now() - t) + 'ms');
}
// mate in one: back rank
let r = findBestMove('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', null, 3); console.log('M1 expect a1a8:', show(r));
// win queen: hanging
r = findBestMove('rnb1kbnr/pppp1ppp/8/4p1q1/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1', null, 3); console.log('take queen c1g5:', show(r));
// KQ vs K should mate eventually vs itself
const g = new Chess('8/8/8/4k3/8/8/8/K6Q w - - 0 1');
let n = 0;
while (!g.status() && n < 120) { const m = findBestMove(g.fen(), [...g.positionCounts], 3); g.move(m); n++; }
console.log('KQK result after plies', n, g.status());
