// Validates every lesson: FENs load, solutions are legal and accepted, stars are reachable.
import { Chess, sq, sqName } from '../src/chess/engine.js';
import { LESSONS } from '../src/tutorial/lessons.js';
let ok = true;
const fail = (l, msg) => { ok = false; console.log('FAIL', l.id, msg); };
for (const l of LESSONS) {
  let c;
  try { c = new Chess(l.fen); } catch (e) { fail(l, 'bad fen'); continue; }
  const side = l.side || 'w';
  if (c.turn !== side) fail(l, 'side to move mismatch');
  if (l.type === 'squares') {
    for (const it of l.items) for (const a of it.answers) if (!/^[a-h][1-8]$/.test(a)) fail(l, 'bad answer ' + a);
  }
  if (l.type === 'stars') {
    // BFS over states (single movable piece set, turn kept) to verify all stars collectable within par
    const start = { fen: c.fen(), left: l.stars.map(sq) };
    let frontier = [start], seen = new Set(), depth = 0, solved = false;
    while (frontier.length && depth < 8 && !solved) {
      const next = [];
      for (const st of frontier) {
        const g = new Chess(st.fen);
        for (const m of g.moves()) {
          if (l.movable && !l.movable.includes(m.piece)) continue;
          const g2 = g.clone(); g2.move(m); g2.turn = side; g2.ep = -1;
          const left = st.left.filter((s) => s !== m.to);
          if (!left.length) { solved = true; break; }
          const key = g2.fen().split(' ')[0] + left.join(',');
          if (seen.has(key)) continue; seen.add(key);
          next.push({ fen: g2.fen(), left });
        }
        if (solved) break;
      }
      frontier = next; depth++;
    }
    if (!solved) fail(l, 'stars unreachable');
    else if (depth > l.par) fail(l, `par ${l.par} but best ${depth}`);
  }
  if (l.type === 'task') {
    const g = c.clone();
    l.steps.forEach((step, i) => {
      const u = step.solution;
      const m = g.findMove(sq(u.slice(0, 2)), sq(u.slice(2, 4)), u[4]);
      if (!m) { fail(l, 'illegal solution ' + u); return; }
      const before = g.clone();
      const r = g.move(m);
      const res = step.accept(r, g, before);
      if (res !== true) fail(l, 'solution rejected: ' + JSON.stringify(res));
      if (step.reply === 'engine' && i < l.steps.length - 1) {
        // simulate the best defence crudely: play first legal move
        const mv = g.moves()[0]; g.move(mv);
      }
    });
  }
  if (l.type === 'play') {
    if (c.status()) fail(l, 'already over');
  }
}
// Extra checks for specific lessons
const st = LESSONS.find((l) => l.id === 'stalemate');
{ const g = new Chess(st.fen); g.move({ from: sq('b1'), to: sq('b6') }); const r = st.steps[0].accept(g.history.at(-1).move, g); console.log('stalemate trap msg:', r); }
const sd = LESSONS.find((l) => l.id === 'scholar-defence');
{ const g = new Chess(sd.fen); g.move({ from: sq('g8'), to: sq('f6') }); const r = sd.steps[0].accept(g.history.at(-1).move, g); console.log('scholar Nf6 ->', r.fail, sqName(r.reply.from) + sqName(r.reply.to)); }
console.log(ok ? 'LESSONS OK' : 'LESSONS FAILED');
process.exit(ok ? 0 : 1);
