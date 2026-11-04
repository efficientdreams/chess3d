// Computer opponent: iterative-deepening alpha-beta with quiescence search,
// MVV-LVA / killer move ordering and tapered piece-square evaluation.
import { Chess, other } from './engine.js';

const VAL = { p: 100, n: 320, b: 335, r: 500, q: 950, k: 0 };

// Piece-square tables from white's point of view, index 0 = a8 (row-major from rank 8).
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    60, 60, 60, 60, 60, 60, 60, 60,
    15, 15, 25, 35, 35, 25, 15, 15,
    5, 5, 12, 28, 28, 12, 5, 5,
    0, 0, 5, 22, 22, 5, 0, 0,
    5, -5, -8, 2, 2, -8, -5, 5,
    5, 10, 10, -22, -22, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -30, 5, 12, 18, 18, 12, 5, -30,
    -30, 0, 18, 22, 22, 18, 0, -30,
    -30, 5, 15, 22, 22, 15, 5, -30,
    -30, 0, 12, 15, 15, 12, 0, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -35, -30, -30, -30, -30, -35, -50],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 12, 10, 10, 12, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 8, 0, 0, 0, 0, 8, -10,
    -20, -10, -12, -10, -10, -12, -10, -20],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 12, 12, 12, 12, 12, 12, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 6, 6, 4, 0, 0],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20],
  kMid: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    15, 15, -5, -10, -10, -5, 15, 15,
    20, 35, 12, -5, 0, 8, 38, 22],
  kEnd: [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50],
};

// Convert engine square (a1=0) to table index for a colour.
const pstIndex = (s, c) => (c === 'w' ? (7 - (s >> 3)) * 8 + (s & 7) : (s >> 3) * 8 + (s & 7));

const MATE = 100000;
const INF = 1000000;

export function evaluate(chess) {
  const b = chess.board;
  let phase = 0;
  let wk = -1, bk = -1;
  let score = 0;
  const bishops = { w: 0, b: 0 };
  const pawnFiles = { w: new Array(8).fill(0), b: new Array(8).fill(0) };
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const sign = p.c === 'w' ? 1 : -1;
    if (p.t === 'k') { if (p.c === 'w') wk = s; else bk = s; continue; }
    score += sign * (VAL[p.t] + PST[p.t][pstIndex(s, p.c)]);
    if (p.t === 'n' || p.t === 'b') phase += 1;
    else if (p.t === 'r') phase += 2;
    else if (p.t === 'q') phase += 4;
    if (p.t === 'b') bishops[p.c]++;
    if (p.t === 'p') pawnFiles[p.c][s & 7]++;
  }
  phase = Math.min(phase, 24);
  const mgW = phase / 24;
  if (wk >= 0) score += mgW * PST.kMid[pstIndex(wk, 'w')] + (1 - mgW) * PST.kEnd[pstIndex(wk, 'w')];
  if (bk >= 0) score -= mgW * PST.kMid[pstIndex(bk, 'b')] + (1 - mgW) * PST.kEnd[pstIndex(bk, 'b')];
  if (bishops.w >= 2) score += 30;
  if (bishops.b >= 2) score -= 30;
  // Doubled / isolated pawns
  for (const c of ['w', 'b']) {
    const sign = c === 'w' ? 1 : -1;
    const pf = pawnFiles[c];
    for (let f = 0; f < 8; f++) {
      if (pf[f] > 1) score -= sign * 12 * (pf[f] - 1);
      if (pf[f] && !(pf[f - 1] || 0) && !(pf[f + 1] || 0)) score -= sign * 10;
    }
  }
  // Endgame: drive the losing king to the corner (helps the engine finish mates).
  if (phase < 8 && wk >= 0 && bk >= 0) {
    const centerDist = (s) => Math.max(3 - (s & 7), (s & 7) - 4) + Math.max(3 - (s >> 3), (s >> 3) - 4);
    const kingDist = Math.abs((wk & 7) - (bk & 7)) + Math.abs((wk >> 3) - (bk >> 3));
    if (score > 200) score += 10 * centerDist(bk) + 4 * (14 - kingDist);
    else if (score < -200) score -= 10 * centerDist(wk) + 4 * (14 - kingDist);
  }
  return chess.turn === 'w' ? score : -score;
}

class Searcher {
  constructor(chess, opts) {
    this.c = chess;
    this.deadline = performance.now() + (opts.timeMs || 1000);
    this.maxDepth = opts.depth || 4;
    this.nodes = 0;
    this.stopped = false;
    this.killers = [];
    this.history = new Map();
    this.tt = new Map();
    // Weaker levels need exact scores for every root move so they can pick
    // a plausible-but-imperfect move; stronger levels use a narrowing window.
    this.exactRoot = (opts.noise || 0) > 0;
  }

  orderMoves(moves, ply, ttMove) {
    const k = this.killers[ply] || [];
    for (const m of moves) {
      let s = 0;
      if (ttMove && m.from === ttMove.from && m.to === ttMove.to && m.promotion === ttMove.promotion) s = 1e6;
      else if (m.captured) s = 10000 + VAL[m.captured] * 10 - VAL[m.piece] / 10;
      else if (m.promotion) s = 9000 + VAL[m.promotion];
      else if (k.some((km) => km && km.from === m.from && km.to === m.to)) s = 8000;
      else s = this.history.get(m.from * 64 + m.to) || 0;
      m._s = s;
    }
    moves.sort((a, b) => b._s - a._s);
    return moves;
  }

  timeUp() {
    if ((++this.nodes & 1023) === 0 && performance.now() > this.deadline) this.stopped = true;
    return this.stopped;
  }

  quiesce(alpha, beta, ply) {
    if (this.timeUp()) return 0;
    const stand = evaluate(this.c);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ply > 40) return alpha;
    const moves = this.orderMoves(this.c.moves({ capturesOnly: true }), ply, null);
    for (const m of moves) {
      // Delta pruning
      if (!m.promotion && stand + VAL[m.captured || 'p'] + 200 < alpha) continue;
      const u = this.c._make(m);
      const sc = -this.quiesce(-beta, -alpha, ply + 1);
      this.c._unmake(m, u);
      if (this.stopped) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  search(depth, alpha, beta, ply) {
    if (this.timeUp()) return 0;
    const c = this.c;
    if (ply > 0) {
      if (c.halfmove >= 100) return 0;
      const key = c.positionKey();
      if (this.path.includes(key) || c.positionCounts.has(key)) return 0;
    }
    const inCheck = c.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    const key = c.positionKey();
    const tte = this.tt.get(key);
    if (tte && tte.depth >= depth && ply > 0) {
      if (tte.flag === 0) return tte.score;
      if (tte.flag === 1 && tte.score >= beta) return beta;
      if (tte.flag === 2 && tte.score <= alpha) return alpha;
    }

    const moves = this.orderMoves(c.moves(), ply, tte && tte.move);
    if (moves.length === 0) return inCheck ? -MATE + ply : 0;

    let best = -INF, bestMove = null;
    const a0 = alpha;
    this.path.push(key);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const u = c._make(m);
      let sc;
      // Late move reduction for quiet moves
      if (i >= 4 && depth >= 3 && !inCheck && !m.captured && !m.promotion) {
        sc = -this.search(depth - 2, -alpha - 1, -alpha, ply + 1);
        if (sc > alpha) sc = -this.search(depth - 1, -beta, -alpha, ply + 1);
      } else {
        sc = -this.search(depth - 1, -beta, -alpha, ply + 1);
      }
      c._unmake(m, u);
      if (this.stopped) { this.path.pop(); return 0; }
      if (sc > best) { best = sc; bestMove = m; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!m.captured) {
          const k = this.killers[ply] || (this.killers[ply] = []);
          k.unshift({ from: m.from, to: m.to });
          k.length = Math.min(k.length, 2);
          const hk = m.from * 64 + m.to;
          this.history.set(hk, (this.history.get(hk) || 0) + depth * depth);
        }
        break;
      }
    }
    this.path.pop();
    const flag = best <= a0 ? 2 : best >= beta ? 1 : 0;
    if (this.tt.size > 400000) this.tt.clear();
    this.tt.set(key, { depth, score: best, flag, move: bestMove && { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion } });
    return best;
  }

  rootSearch() {
    const c = this.c;
    let rootMoves = c.moves();
    if (!rootMoves.length) return null;
    let bestMove = rootMoves[0], bestScore = 0;
    const scored = [];
    for (let depth = 1; depth <= this.maxDepth; depth++) {
      let alpha = -INF, beta = INF;
      let curBest = null, curScore = -INF - 1;
      const results = [];
      this.path = [];
      rootMoves = this.orderMoves(rootMoves, 0, bestMove);
      for (const m of rootMoves) {
        const u = c._make(m);
        const sc = -this.search(depth - 1, -beta, -alpha, 1);
        c._unmake(m, u);
        if (this.stopped) break;
        results.push({ m, sc });
        if (sc > curScore) { curScore = sc; curBest = m; }
        if (sc > alpha && !this.exactRoot) alpha = sc;
      }
      if (this.stopped && !curBest) break;
      if (curBest) { bestMove = curBest; bestScore = curScore; }
      if (!this.stopped) { scored.length = 0; scored.push(...results); }
      if (this.stopped || Math.abs(bestScore) > MATE - 100) break;
    }
    return { move: bestMove, score: bestScore, scored };
  }
}

// Difficulty presets.
export const LEVELS = {
  1: { name: 'Squire', depth: 1, timeMs: 300, noise: 220, blunder: 0.25 },
  2: { name: 'Yeoman', depth: 2, timeMs: 600, noise: 80, blunder: 0.08 },
  3: { name: 'Knight', depth: 4, timeMs: 1200, noise: 0, blunder: 0 },
  4: { name: 'Sheriff', depth: 6, timeMs: 2500, noise: 0, blunder: 0 },
  5: { name: 'Outlaw King', depth: 12, timeMs: 5000, noise: 0, blunder: 0 },
};

export function findBestMove(fen, historyKeys, level = 3) {
  const cfg = LEVELS[level] || LEVELS[3];
  const chess = new Chess(fen);
  // Restore repetition knowledge
  if (historyKeys) for (const [k, n] of historyKeys) chess.positionCounts.set(k, n);
  const s = new Searcher(chess, cfg);
  const res = s.rootSearch();
  if (!res) return null;
  let move = res.move;
  if ((cfg.noise || cfg.blunder) && res.scored.length > 1) {
    if (Math.random() < cfg.blunder) {
      move = res.scored[Math.floor(Math.random() * res.scored.length)].m;
    } else {
      // Pick among moves within a noisy margin of the best.
      let best = -Infinity;
      for (const r of res.scored) {
        const v = r.sc + (Math.random() - 0.5) * 2 * cfg.noise;
        if (v > best) { best = v; move = r.m; }
      }
      // Never miss a mate-in-one or hang into a forced mate at low levels.
      const top = res.scored.reduce((a, b) => (b.sc > a.sc ? b : a));
      if (top.sc > MATE - 100) move = top.m;
    }
  }
  return { from: move.from, to: move.to, promotion: move.promotion, score: res.score, nodes: s.nodes };
}

export { other };
