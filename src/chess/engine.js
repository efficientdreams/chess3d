// Complete chess rules engine.
// Board: array of 64 squares, index = rank * 8 + file (a1 = 0, h8 = 63).
// Piece: { t: 'p'|'n'|'b'|'r'|'q'|'k', c: 'w'|'b' } or null.
// The engine tolerates positions without kings (used by tutorial drills).

export const FILES = 'abcdefgh';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const sq = (name) => FILES.indexOf(name[0]) + (parseInt(name[1], 10) - 1) * 8;
export const sqName = (i) => FILES[i & 7] + ((i >> 3) + 1);
export const fileOf = (i) => i & 7;
export const rankOf = (i) => i >> 3;
export const other = (c) => (c === 'w' ? 'b' : 'w');

export const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// Precomputed target lists for speed.
const KNIGHT_T = [];
const KING_T = [];
const RAYS = { r: [], b: [] };
for (let s = 0; s < 64; s++) {
  const f = s & 7, r = s >> 3;
  KNIGHT_T[s] = KNIGHT_D.filter(([df, dr]) => inB(f + df, r + dr)).map(([df, dr]) => s + df + dr * 8);
  KING_T[s] = KING_D.filter(([df, dr]) => inB(f + df, r + dr)).map(([df, dr]) => s + df + dr * 8);
  RAYS.r[s] = ROOK_D.map(([df, dr]) => ray(f, r, df, dr));
  RAYS.b[s] = BISHOP_D.map(([df, dr]) => ray(f, r, df, dr));
}
function inB(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }
function ray(f, r, df, dr) {
  const out = [];
  let x = f + df, y = r + dr;
  while (inB(x, y)) { out.push(x + y * 8); x += df; y += dr; }
  return out;
}

export class Chess {
  constructor(fen = START_FEN) {
    this.load(fen);
  }

  load(fen) {
    const parts = fen.trim().split(/\s+/);
    this.board = new Array(64).fill(null);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN: ' + fen);
    for (let i = 0; i < 8; i++) {
      const rank = 7 - i;
      let file = 0;
      for (const ch of rows[i]) {
        if (/\d/.test(ch)) { file += parseInt(ch, 10); continue; }
        const c = ch === ch.toUpperCase() ? 'w' : 'b';
        this.board[rank * 8 + file] = { t: ch.toLowerCase(), c };
        file++;
      }
    }
    this.turn = parts[1] === 'b' ? 'b' : 'w';
    const cs = parts[2] || '-';
    this.castling = { K: cs.includes('K'), Q: cs.includes('Q'), k: cs.includes('k'), q: cs.includes('q') };
    this.ep = parts[3] && parts[3] !== '-' ? sq(parts[3]) : -1;
    this.halfmove = parseInt(parts[4] || '0', 10);
    this.fullmove = parseInt(parts[5] || '1', 10);
    this.history = [];
    this.positionCounts = new Map();
    this._countPosition(1);
    this._sanitizeCastling();
  }

  _sanitizeCastling() {
    const b = this.board;
    const is = (s, t, c) => b[s] && b[s].t === t && b[s].c === c;
    if (!is(4, 'k', 'w')) { this.castling.K = this.castling.Q = false; }
    if (!is(7, 'r', 'w')) this.castling.K = false;
    if (!is(0, 'r', 'w')) this.castling.Q = false;
    if (!is(60, 'k', 'b')) { this.castling.k = this.castling.q = false; }
    if (!is(63, 'r', 'b')) this.castling.k = false;
    if (!is(56, 'r', 'b')) this.castling.q = false;
  }

  clone() {
    const c = Object.create(Chess.prototype);
    c.board = this.board.map((p) => (p ? { t: p.t, c: p.c } : null));
    c.turn = this.turn;
    c.castling = { ...this.castling };
    c.ep = this.ep;
    c.halfmove = this.halfmove;
    c.fullmove = this.fullmove;
    c.history = this.history.slice();
    c.positionCounts = new Map(this.positionCounts);
    return c;
  }

  fen() {
    let s = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = this.board[rank * 8 + file];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        s += p.c === 'w' ? p.t.toUpperCase() : p.t;
      }
      if (empty) s += empty;
      if (rank) s += '/';
    }
    let cs = '';
    if (this.castling.K) cs += 'K';
    if (this.castling.Q) cs += 'Q';
    if (this.castling.k) cs += 'k';
    if (this.castling.q) cs += 'q';
    return `${s} ${this.turn} ${cs || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.halfmove} ${this.fullmove}`;
  }

  // Key used for repetition detection (position + side + castling + ep).
  positionKey() {
    return this.fen().split(' ').slice(0, 4).join(' ');
  }

  _countPosition(delta) {
    const k = this.positionKey();
    const n = (this.positionCounts.get(k) || 0) + delta;
    if (n <= 0) this.positionCounts.delete(k); else this.positionCounts.set(k, n);
  }

  get(s) { return this.board[typeof s === 'string' ? sq(s) : s]; }

  put(piece, s) { this.board[typeof s === 'string' ? sq(s) : s] = piece ? { t: piece.t, c: piece.c } : null; }

  kingSquare(color) {
    for (let i = 0; i < 64; i++) {
      const p = this.board[i];
      if (p && p.t === 'k' && p.c === color) return i;
    }
    return -1;
  }

  // Is square s attacked by any piece of color `by`?
  isAttacked(s, by) {
    const b = this.board;
    // Pawns
    const f = s & 7;
    if (by === 'w') {
      if (s >= 8) {
        if (f > 0) { const p = b[s - 9]; if (p && p.c === 'w' && p.t === 'p') return true; }
        if (f < 7) { const p = b[s - 7]; if (p && p.c === 'w' && p.t === 'p') return true; }
      }
    } else if (s < 56) {
      if (f > 0) { const p = b[s + 7]; if (p && p.c === 'b' && p.t === 'p') return true; }
      if (f < 7) { const p = b[s + 9]; if (p && p.c === 'b' && p.t === 'p') return true; }
    }
    for (const t of KNIGHT_T[s]) { const p = b[t]; if (p && p.c === by && p.t === 'n') return true; }
    for (const t of KING_T[s]) { const p = b[t]; if (p && p.c === by && p.t === 'k') return true; }
    for (const r of RAYS.r[s]) {
      for (const t of r) {
        const p = b[t];
        if (p) { if (p.c === by && (p.t === 'r' || p.t === 'q')) return true; break; }
      }
    }
    for (const r of RAYS.b[s]) {
      for (const t of r) {
        const p = b[t];
        if (p) { if (p.c === by && (p.t === 'b' || p.t === 'q')) return true; break; }
      }
    }
    return false;
  }

  attackersOf(s, by) {
    const out = [];
    for (let i = 0; i < 64; i++) {
      const p = this.board[i];
      if (!p || p.c !== by) continue;
      if (this._pieceAttacks(i, s)) out.push(i);
    }
    return out;
  }

  _pieceAttacks(from, to) {
    const p = this.board[from];
    if (!p) return false;
    const df = (to & 7) - (from & 7), dr = (to >> 3) - (from >> 3);
    switch (p.t) {
      case 'p': return Math.abs(df) === 1 && dr === (p.c === 'w' ? 1 : -1);
      case 'n': return KNIGHT_T[from].includes(to);
      case 'k': return KING_T[from].includes(to);
      default: {
        const dirs = p.t === 'r' ? RAYS.r[from] : p.t === 'b' ? RAYS.b[from] : RAYS.r[from].concat(RAYS.b[from]);
        for (const r of dirs) {
          for (const t of r) {
            if (t === to) return true;
            if (this.board[t]) break;
          }
        }
        return false;
      }
    }
  }

  inCheck(color = this.turn) {
    const k = this.kingSquare(color);
    return k >= 0 && this.isAttacked(k, other(color));
  }

  // Pseudo-legal moves for `color`.
  _pseudo(color, capturesOnly = false) {
    const moves = [];
    const b = this.board;
    const opp = other(color);
    const add = (from, to, extra) => {
      const m = { from, to, piece: b[from].t, color };
      if (b[to]) m.captured = b[to].t;
      if (extra) Object.assign(m, extra);
      moves.push(m);
    };
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p || p.c !== color) continue;
      const f = s & 7, r = s >> 3;
      if (p.t === 'p') {
        const dir = color === 'w' ? 8 : -8;
        const startRank = color === 'w' ? 1 : 6;
        const promoRank = color === 'w' ? 7 : 0;
        const one = s + dir;
        const pushPromo = (from, to, extra) => {
          if ((to >> 3) === promoRank) {
            for (const pr of ['q', 'r', 'b', 'n']) add(from, to, { ...extra, promotion: pr });
          } else add(from, to, extra);
        };
        if (one >= 0 && one < 64 && !b[one]) {
          if (!capturesOnly || (one >> 3) === promoRank) pushPromo(s, one);
          const two = s + 2 * dir;
          if (!capturesOnly && r === startRank && !b[two]) add(s, two, { double: true });
        }
        for (const df of [-1, 1]) {
          if (f + df < 0 || f + df > 7) continue;
          const t = one + df;
          if (t < 0 || t >= 64) continue;
          if (b[t] && b[t].c === opp) pushPromo(s, t);
          else if (t === this.ep && !b[t]) add(s, t, { enPassant: true, captured: 'p' });
        }
      } else if (p.t === 'n' || p.t === 'k') {
        for (const t of p.t === 'n' ? KNIGHT_T[s] : KING_T[s]) {
          if (b[t] && b[t].c === color) continue;
          if (capturesOnly && !b[t]) continue;
          add(s, t);
        }
        if (p.t === 'k' && !capturesOnly) this._castleMoves(color, s, add);
      } else {
        const dirs = p.t === 'r' ? RAYS.r[s] : p.t === 'b' ? RAYS.b[s] : RAYS.r[s].concat(RAYS.b[s]);
        for (const rr of dirs) {
          for (const t of rr) {
            if (b[t]) { if (b[t].c === opp) add(s, t); break; }
            if (!capturesOnly) add(s, t);
          }
        }
      }
    }
    return moves;
  }

  _castleMoves(color, s, add) {
    const b = this.board;
    const opp = other(color);
    if (color === 'w' && s === 4) {
      if (this.castling.K && !b[5] && !b[6] && b[7] && b[7].t === 'r' && b[7].c === 'w' &&
          !this.isAttacked(4, opp) && !this.isAttacked(5, opp) && !this.isAttacked(6, opp)) add(4, 6, { castle: 'K' });
      if (this.castling.Q && !b[3] && !b[2] && !b[1] && b[0] && b[0].t === 'r' && b[0].c === 'w' &&
          !this.isAttacked(4, opp) && !this.isAttacked(3, opp) && !this.isAttacked(2, opp)) add(4, 2, { castle: 'Q' });
    } else if (color === 'b' && s === 60) {
      if (this.castling.k && !b[61] && !b[62] && b[63] && b[63].t === 'r' && b[63].c === 'b' &&
          !this.isAttacked(60, opp) && !this.isAttacked(61, opp) && !this.isAttacked(62, opp)) add(60, 62, { castle: 'k' });
      if (this.castling.q && !b[59] && !b[58] && !b[57] && b[56] && b[56].t === 'r' && b[56].c === 'b' &&
          !this.isAttacked(60, opp) && !this.isAttacked(59, opp) && !this.isAttacked(58, opp)) add(60, 58, { castle: 'q' });
    }
  }

  // Legal moves. opts: { square, color, capturesOnly }
  moves(opts = {}) {
    const color = opts.color || this.turn;
    let list = this._pseudo(color, !!opts.capturesOnly);
    if (opts.square !== undefined) {
      const s = typeof opts.square === 'string' ? sq(opts.square) : opts.square;
      list = list.filter((m) => m.from === s);
    }
    const legal = [];
    const hasKing = this.kingSquare(color) >= 0;
    for (const m of list) {
      if (!hasKing) { legal.push(m); continue; }
      const undo = this._make(m);
      const ok = !this.inCheck(color);
      this._unmake(m, undo);
      if (ok) legal.push(m);
    }
    return legal;
  }

  // Low-level make/unmake used by search & legality checks (no history/SAN).
  _make(m) {
    const b = this.board;
    const undo = {
      castling: { ...this.castling }, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove,
      turn: this.turn, captured: null, capSq: m.to,
    };
    const piece = b[m.from];
    if (m.enPassant) {
      undo.capSq = m.to + (m.color === 'w' ? -8 : 8);
      undo.captured = b[undo.capSq];
      b[undo.capSq] = null;
    } else {
      undo.captured = b[m.to];
    }
    b[m.to] = m.promotion ? { t: m.promotion, c: piece.c } : piece;
    b[m.from] = null;
    if (m.castle) {
      const [rf, rt] = { K: [7, 5], Q: [0, 3], k: [63, 61], q: [56, 59] }[m.castle];
      b[rt] = b[rf];
      b[rf] = null;
    }
    // Castling rights
    if (piece.t === 'k') {
      if (piece.c === 'w') { this.castling.K = this.castling.Q = false; } else { this.castling.k = this.castling.q = false; }
    }
    for (const s of [m.from, m.to]) {
      if (s === 0) this.castling.Q = false;
      if (s === 7) this.castling.K = false;
      if (s === 56) this.castling.q = false;
      if (s === 63) this.castling.k = false;
    }
    this.ep = m.double ? (m.from + m.to) >> 1 : -1;
    this.halfmove = piece.t === 'p' || undo.captured ? 0 : this.halfmove + 1;
    if (this.turn === 'b') this.fullmove++;
    this.turn = other(this.turn);
    return undo;
  }

  _unmake(m, undo) {
    const b = this.board;
    const moved = b[m.to];
    b[m.from] = m.promotion ? { t: 'p', c: moved.c } : moved;
    b[m.to] = null;
    if (undo.captured) b[undo.capSq] = undo.captured;
    if (m.castle) {
      const [rf, rt] = { K: [7, 5], Q: [0, 3], k: [63, 61], q: [56, 59] }[m.castle];
      b[rf] = b[rt];
      b[rt] = null;
    }
    this.castling = undo.castling;
    this.ep = undo.ep;
    this.halfmove = undo.halfmove;
    this.fullmove = undo.fullmove;
    this.turn = undo.turn;
  }

  // Find a legal move matching {from, to, promotion}. Accepts square names.
  findMove(from, to, promotion) {
    const f = typeof from === 'string' ? sq(from) : from;
    const t = typeof to === 'string' ? sq(to) : to;
    const cands = this.moves({ square: f }).filter((m) => m.to === t);
    if (!cands.length) return null;
    if (cands.length > 1) return cands.find((m) => m.promotion === (promotion || 'q')) || cands[0];
    return cands[0];
  }

  // Public move: plays a legal move object or {from,to,promotion}; records history and SAN.
  move(mv) {
    if (!mv) return null;
    const m = this.findMove(mv.from, mv.to, mv.promotion);
    if (!m) return null;
    const san = this.san(m);
    const undo = this._make(m);
    const full = { ...m, san };
    const check = this.inCheck(this.turn);
    const mate = check && this.moves().length === 0;
    full.san = san + (mate ? '#' : check ? '+' : '');
    full.check = check;
    full.mate = mate;
    this.history.push({ move: full, undo });
    this._countPosition(1);
    return full;
  }

  undo() {
    const h = this.history.pop();
    if (!h) return null;
    this._countPosition(-1);
    this._unmake(h.move, h.undo);
    return h.move;
  }

  san(m) {
    if (m.castle) return m.castle.toUpperCase() === 'K' ? 'O-O' : 'O-O-O';
    const to = sqName(m.to);
    if (m.piece === 'p') {
      let s = m.captured ? FILES[m.from & 7] + 'x' + to : to;
      if (m.promotion) s += '=' + m.promotion.toUpperCase();
      return s;
    }
    let s = m.piece.toUpperCase();
    // Disambiguation
    const others = this.moves().filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
    if (others.length) {
      const sameFile = others.some((o) => (o.from & 7) === (m.from & 7));
      const sameRank = others.some((o) => (o.from >> 3) === (m.from >> 3));
      if (!sameFile) s += FILES[m.from & 7];
      else if (!sameRank) s += (m.from >> 3) + 1;
      else s += sqName(m.from);
    }
    if (m.captured) s += 'x';
    return s + to;
  }

  insufficientMaterial() {
    const pieces = [];
    for (let i = 0; i < 64; i++) {
      const p = this.board[i];
      if (p && p.t !== 'k') pieces.push({ ...p, s: i });
    }
    if (pieces.length === 0) return true;
    if (pieces.some((p) => p.t === 'p' || p.t === 'r' || p.t === 'q')) return false;
    if (pieces.length === 1) return true; // K+minor vs K
    // Only bishops, all on same colour
    if (pieces.every((p) => p.t === 'b')) {
      const col = (s) => ((s & 7) + (s >> 3)) & 1;
      return pieces.every((p) => col(p.s) === col(pieces[0].s));
    }
    return false;
  }

  isThreefold() {
    return (this.positionCounts.get(this.positionKey()) || 0) >= 3;
  }

  // Returns null if game continues, otherwise { result: '1-0'|'0-1'|'1/2-1/2', reason }
  status() {
    const legal = this.moves();
    if (legal.length === 0) {
      if (this.inCheck()) {
        return { result: this.turn === 'w' ? '0-1' : '1-0', reason: 'checkmate', winner: other(this.turn) };
      }
      return { result: '1/2-1/2', reason: 'stalemate' };
    }
    if (this.halfmove >= 100) return { result: '1/2-1/2', reason: 'fifty-move rule' };
    if (this.isThreefold()) return { result: '1/2-1/2', reason: 'threefold repetition' };
    if (this.kingSquare('w') >= 0 && this.kingSquare('b') >= 0 && this.insufficientMaterial()) {
      return { result: '1/2-1/2', reason: 'insufficient material' };
    }
    return null;
  }

  pgnMoves() {
    const out = [];
    for (const h of this.history) out.push(h.move.san);
    return out;
  }
}
