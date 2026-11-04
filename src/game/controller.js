// Ties the rules engine, the 3D board, piece meshes, input and the computer player together.
import * as THREE from 'three';
import { Chess, START_FEN, other, sqName } from '../chess/engine.js';
import { createPiece } from '../pieces/index.js';
import { squareToLocal } from '../scene/board.js';

const GRAVE_Y = -0.42; // stump surface in board units (board thickness)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class GameController extends EventTarget {
  constructor({ camera, renderer, controls, board, audio }) {
    super();
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.board = board;
    this.audio = audio;

    this.chess = new Chess();
    this.pieceSet = 'classic';
    this.mode = 'menu'; // 'menu' | 'ai' | 'pvp' | 'tutorial'
    this.humanColors = new Set(['w', 'b']);
    this.aiLevel = 3;
    this.showLegal = true;
    this.autoRotate = false;
    this.pieces = new Map();
    this.graves = { w: [], b: [] };
    this.selected = -1;
    this.anims = [];
    this.busy = false;
    this.thinking = false;
    this.gameOver = null;
    this.hooks = {};
    this.inputEnabled = true;
    this.viewColor = 'w';
    this.camTween = null;
    this.cinematic = true;
    this.time = 0;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._down = null;
    this._requestId = 0;
    this._initWorker();
    this._bindInput();
    this.syncAll();
  }

  // ------------------------------------------------------------ events
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  // ------------------------------------------------------------ AI worker
  _initWorker() {
    try {
      this.worker = new Worker(new URL('../chess/ai.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this._onWorker(e.data);
      this.worker.onerror = (e) => { console.warn('AI worker failed, falling back to main thread', e); this.worker = null; };
    } catch (err) {
      console.warn('Workers unavailable', err);
      this.worker = null;
    }
    this._pending = new Map();
  }

  _onWorker({ id, result }) {
    const cb = this._pending.get(id);
    if (cb) { this._pending.delete(id); cb(result); }
  }

  askEngine(level, chess = this.chess) {
    const id = ++this._requestId;
    const payload = { id, fen: chess.fen(), historyKeys: [...chess.positionCounts], level };
    return new Promise((resolve) => {
      if (this.worker) {
        this._pending.set(id, resolve);
        this.worker.postMessage(payload);
      } else {
        import('../chess/ai.js').then(({ findBestMove }) => {
          setTimeout(() => resolve(findBestMove(payload.fen, payload.historyKeys, level)), 30);
        });
      }
    });
  }

  // ------------------------------------------------------------ pieces
  setPieceSet(id) {
    this.pieceSet = id;
    this.syncAll();
  }

  _makePiece(type, color) {
    const obj = createPiece(this.pieceSet, type, color);
    this.board.root.add(obj);
    return obj;
  }

  _removeObj(obj) {
    this.board.root.remove(obj);
  }

  // Rebuild every piece mesh from the engine state (and the captured graveyard from history).
  syncAll() {
    this.anims = [];
    for (const obj of this.pieces.values()) this._removeObj(obj);
    for (const c of ['w', 'b']) for (const obj of this.graves[c]) this._removeObj(obj);
    this.pieces.clear();
    this.graves = { w: [], b: [] };
    for (let i = 0; i < 64; i++) {
      const p = this.chess.board[i];
      if (!p) continue;
      const obj = this._makePiece(p.t, p.c);
      obj.position.copy(squareToLocal(i));
      obj.userData.square = i;
      this.pieces.set(i, obj);
    }
    for (const h of this.chess.history) {
      const m = h.move;
      if (m.captured) {
        const obj = this._makePiece(m.captured, other(m.color));
        obj.position.copy(this._graveSlot(m.color, this.graves[m.color].length));
        obj.scale.setScalar(0.8);
        this.graves[m.color].push(obj);
      }
    }
    this.selected = -1;
    this.board.clearMoveMarkers();
    this._refreshHighlights();
  }

  // Captured pieces stand on the stump beside the board.
  _graveSlot(capturer, k) {
    const sign = capturer === 'w' ? 1 : -1;
    const col = Math.floor(k / 8), row = k % 8;
    const x = sign * (5.35 + col * 0.85);
    const z = sign * (-3.2 + row * 0.9);
    return new THREE.Vector3(x, GRAVE_Y, z);
  }

  // ------------------------------------------------------------ game setup
  newGame({ mode = 'pvp', humanColor = 'w', level = 3, fen = START_FEN } = {}) {
    this._requestId++;
    this._pending.clear();
    this.mode = mode;
    this.aiLevel = level;
    this.chess = new Chess(fen);
    this.gameOver = null;
    this.thinking = false;
    this.busy = false;
    this.hooks = {};
    this.inputEnabled = true;
    if (mode === 'ai') this.humanColors = new Set([humanColor]);
    else this.humanColors = new Set(['w', 'b']);
    this.board.clearHighlights();
    this.board.setStars([]);
    this.syncAll();
    this.cinematic = false;
    this.setView(mode === 'ai' ? humanColor : 'w');
    this.emit('change');
    this._maybeAI();
  }

  // Used by the tutorial to set up arbitrary positions.
  loadPosition(fen, { humanColor = 'w', hooks = {} } = {}) {
    this._requestId++;
    this._pending.clear();
    this.mode = 'tutorial';
    this.chess = new Chess(fen);
    this.gameOver = null;
    this.thinking = false;
    this.busy = false;
    this.hooks = hooks;
    this.inputEnabled = true;
    this.humanColors = new Set([humanColor]);
    this.board.clearHighlights();
    this.syncAll();
    const wasCinematic = this.cinematic;
    this.cinematic = false;
    if (wasCinematic || this.viewColor !== humanColor || !this._viewSet) this.setView(humanColor);
    this.emit('change');
  }

  setTurn(color) {
    this.chess.turn = color;
    this.chess.ep = -1;
    this._refreshHighlights();
    this.emit('change');
  }

  isHumanTurn() {
    return this.humanColors.has(this.chess.turn) && !this.gameOver && this.mode !== 'menu';
  }

  // ------------------------------------------------------------ input
  _bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this._down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!this._down) return;
      const d = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
      this._down = null;
      if (d > 7) return;
      let sqi = this._pick(e);
      // A tall piece can visually overlap the square behind it: when a piece is selected,
      // prefer the board square under the pointer if it is a legal destination.
      if (this.selected >= 0 && this._lastPlaneSquare >= 0 && this._lastPlaneSquare !== sqi) {
        const legal = this.chess.moves({ square: this.selected }).some((m) => m.to === this._lastPlaneSquare);
        const hitLegal = this.chess.moves({ square: this.selected }).some((m) => m.to === sqi);
        if (legal && !hitLegal) sqi = this._lastPlaneSquare;
      }
      if (sqi >= 0) this.clickSquare(sqi);
      else if (this.selected >= 0) this.deselect();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || this.mode === 'menu') { this.board.setHover(-1); return; }
      const sqi = this._pick(e);
      this.board.setHover(sqi);
      el.style.cursor = sqi >= 0 && (this.pieces.has(sqi) || this.selected >= 0) ? 'pointer' : 'default';
    });
    el.addEventListener('pointerleave', () => this.board.setHover(-1));
  }

  _pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const bh = this.raycaster.intersectObject(this.board.pickPlane, false);
    this._lastPlaneSquare = bh.length ? this.board.pointToSquare(bh[0].point) : -1;
    const objs = [...this.pieces.values()];
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      const root = h.object.userData.pieceRoot;
      if (root && root.userData.square !== undefined && this.pieces.get(root.userData.square) === root) return root.userData.square;
    }
    return this._lastPlaneSquare;
  }

  clickSquare(i) {
    if (this.mode === 'menu' || !this.inputEnabled) return;
    if (this.hooks.onSquareClick && this.hooks.onSquareClick(i)) return;
    if (this.busy || this.thinking || this.gameOver || !this.isHumanTurn()) {
      if (this.thinking) this.emit('toast', { text: 'The computer is thinking…' });
      return;
    }
    const p = this.chess.board[i];
    if (this.selected >= 0) {
      if (i === this.selected) { this.deselect(); return; }
      const cands = this.chess.moves({ square: this.selected }).filter((m) => m.to === i);
      if (cands.length) { this._playerMove(cands); return; }
      if (p && p.c === this.chess.turn) { this.select(i); return; }
      // Illegal destination: explain if possible
      const msg = this.hooks.onIllegal && this.hooks.onIllegal(this.selected, i);
      if (msg) { this.emit('toast', { text: msg, kind: 'warn' }); this.audio.wrong(); } else this._explainIllegal(this.selected, i);
      this.deselect();
      return;
    }
    if (p && p.c === this.chess.turn) this.select(i);
    else if (p && p.c !== this.chess.turn) this.emit('toast', { text: `It's ${this.chess.turn === 'w' ? 'White' : 'Black'}'s turn to move.` });
  }

  _explainIllegal(from, to) {
    const p = this.chess.board[from];
    if (!p) return;
    const pseudo = this.chess._pseudo(p.c).filter((m) => m.from === from && m.to === to);
    if (pseudo.length) {
      this.emit('toast', { text: this.chess.inCheck() ? 'You must get your king out of check!' : 'That move would leave your king in check.', kind: 'warn' });
      this.audio.wrong();
    }
  }

  select(i) {
    if (this.hooks.canSelect && !this.hooks.canSelect(i)) return;
    this.selected = i;
    const moves = this.chess.moves({ square: i });
    if (this.showLegal || this.mode === 'tutorial') this.board.showMoveMarkers(moves);
    this.audio.select();
    if (moves.length === 0) this.emit('toast', { text: 'That piece has no legal moves.' });
    this._refreshHighlights();
  }

  deselect() {
    this.selected = -1;
    this.board.clearMoveMarkers();
    this._refreshHighlights();
  }

  async _playerMove(cands) {
    let move = cands[0];
    if (cands.length > 1 && cands[0].promotion) {
      const choice = await new Promise((resolve) => this.emit('promotion', { color: this.chess.turn, resolve }));
      move = cands.find((m) => m.promotion === choice) || cands[0];
    }
    if (this.hooks.validateMove) {
      const v = this.hooks.validateMove(move);
      if (v && v.ok === false) {
        if (v.message) this.emit('toast', { text: v.message, kind: 'warn' });
        this.audio.wrong();
        this.deselect();
        return;
      }
    }
    await this.playMove(move);
  }

  // ------------------------------------------------------------ moves & animation
  async playMove(mv, { animate = true } = {}) {
    const result = this.chess.move(mv);
    if (!result) return null;
    this.selected = -1;
    this.board.clearMoveMarkers();
    this.board.clearHighlights('hint');
    this.busy = true;
    await this._animateMove(result, animate);
    this.busy = false;
    this._refreshHighlights();
    this.audio.move(!!result.captured);
    if (result.check) setTimeout(() => this.audio.check(), 120);
    this.emit('move', result);
    if (this.hooks.afterMove) {
      await this.hooks.afterMove(result);
    } else {
      this._afterMove();
    }
    this.emit('change');
    return result;
  }

  _afterMove() {
    const st = this.chess.status();
    if (st) {
      this.gameOver = st;
      this.emit('gameover', st);
      this.audio.fanfare();
      return;
    }
    if (this.mode === 'pvp' && this.autoRotate) this.setView(this.chess.turn);
    this._maybeAI();
  }

  async _maybeAI() {
    if (this.mode !== 'ai' || this.gameOver || this.humanColors.has(this.chess.turn)) return;
    this.thinking = true;
    this.emit('change');
    const reqId = this._requestId + 1;
    const started = performance.now();
    const res = await this.askEngine(this.aiLevel);
    if (reqId !== this._requestId) return; // stale (undo/new game)
    // Give the player a beat to see the position
    const wait = Math.max(0, 450 - (performance.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    if (reqId !== this._requestId) return;
    this.thinking = false;
    if (res) await this.playMove(res);
    else this.emit('change');
  }

  _animateMove(m, animate) {
    const obj = this.pieces.get(m.from);
    const jobs = [];
    const capSq = m.enPassant ? m.to + (m.color === 'w' ? -8 : 8) : m.to;
    if (m.captured) {
      const victim = this.pieces.get(capSq);
      this.pieces.delete(capSq);
      if (victim) {
        victim.userData.square = undefined;
        const slot = this._graveSlot(m.color, this.graves[m.color].length);
        this.graves[m.color].push(victim);
        jobs.push(this._tween(victim, slot, { dur: 0.75, delay: animate ? 0.28 : 0, arc: 2.2, scaleTo: 0.8, spin: true, animate }));
      }
    }
    this.pieces.delete(m.from);
    if (obj) {
      this.pieces.set(m.to, obj);
      obj.userData.square = m.to;
      const dist = Math.hypot((m.to & 7) - (m.from & 7), (m.to >> 3) - (m.from >> 3));
      const arc = m.piece === 'n' ? 1.1 : 0.25 + dist * 0.06;
      jobs.push(this._tween(obj, squareToLocal(m.to), { dur: 0.38 + dist * 0.045, arc, animate }));
    }
    if (m.castle) {
      const [rf, rt] = { K: [7, 5], Q: [0, 3], k: [63, 61], q: [56, 59] }[m.castle];
      const rook = this.pieces.get(rf);
      this.pieces.delete(rf);
      if (rook) {
        this.pieces.set(rt, rook);
        rook.userData.square = rt;
        jobs.push(this._tween(rook, squareToLocal(rt), { dur: 0.5, delay: animate ? 0.15 : 0, arc: 0.9, animate }));
      }
    }
    return Promise.all(jobs).then(() => {
      if (m.promotion) {
        const old = this.pieces.get(m.to);
        if (old) this._removeObj(old);
        const np = this._makePiece(m.promotion, m.color);
        np.position.copy(squareToLocal(m.to));
        np.userData.square = m.to;
        np.scale.setScalar(0.01);
        this.pieces.set(m.to, np);
        return this._tween(np, squareToLocal(m.to), { dur: 0.35, scaleFrom: 0.01, scaleTo: 1, arc: 0, animate });
      }
      return null;
    });
  }

  _tween(obj, to, { dur = 0.4, delay = 0, arc = 0.3, scaleTo = null, scaleFrom = null, spin = false, animate = true } = {}) {
    return new Promise((resolve) => {
      if (!animate) {
        obj.position.copy(to);
        if (scaleTo !== null) obj.scale.setScalar(scaleTo);
        resolve();
        return;
      }
      this.anims.push({
        obj, from: obj.position.clone(), to: to.clone(), t: -delay, dur, arc,
        s0: scaleFrom ?? obj.scale.x, s1: scaleTo ?? obj.scale.x, spin, rot0: obj.rotation.y, resolve,
      });
    });
  }

  undo() {
    if (this.busy) return;
    if (this.mode === 'menu' || this.chess.history.length === 0) return;
    this._requestId++;
    this.thinking = false;
    this.chess.undo();
    // In computer games, take back the computer's reply too.
    if (this.mode === 'ai' && !this.humanColors.has(this.chess.turn) && this.chess.history.length) this.chess.undo();
    this.gameOver = null;
    this.syncAll();
    this.emit('change');
    this._maybeAI();
  }

  // Take back moves without the computer-reply logic (used by lessons).
  revert(n = 1) {
    for (let k = 0; k < n; k++) this.chess.undo();
    this.syncAll();
    this.emit('change');
  }

  async hint() {
    if (!this.isHumanTurn() || this.busy || this.thinking) return null;
    this.emit('toast', { text: 'Consulting the wise old oak…' });
    const res = await this.askEngine(4);
    if (!res) return null;
    this.board.setHighlights('hint', [res.from, res.to], '#4fd1ff', 0.55, 0.008);
    this.emit('toast', { text: `Try ${this.chess.san(this.chess.findMove(res.from, res.to, res.promotion))}  (${sqName(res.from)} → ${sqName(res.to)})` });
    return res;
  }

  _refreshHighlights() {
    const h = this.chess.history;
    if (h.length) {
      const last = h[h.length - 1].move;
      this.board.setHighlights('last', [last.from, last.to], '#f0d64a', 0.42);
    } else this.board.clearHighlights('last');
    if (this.selected >= 0) this.board.setHighlights('sel', [this.selected], '#ffe066', 0.55, 0.005);
    else this.board.clearHighlights('sel');
    const k = this.chess.kingSquare(this.chess.turn);
    if (k >= 0 && this.chess.inCheck()) this.board.setHighlights('check', [k], '#ff3b30', 0.6, 0.007);
    else this.board.clearHighlights('check');
  }

  // ------------------------------------------------------------ camera
  setView(color, immediate = false) {
    this.viewColor = color;
    this._viewSet = true;
    const target = this.controls.target;
    const off = this.camera.position.clone().sub(target);
    const sph = new THREE.Spherical().setFromVector3(off);
    const goal = new THREE.Spherical(this.fitRadius(), 0.92, color === 'w' ? 0 : Math.PI);
    if (immediate) {
      this.camera.position.setFromSpherical(goal).add(target);
      this.controls.update();
      return;
    }
    // Shortest rotation around the board
    let dTheta = goal.theta - sph.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    this.camTween = { from: sph, to: new THREE.Spherical(goal.radius, goal.phi, sph.theta + dTheta), t: 0, dur: 1.4 };
  }

  // Distance at which the whole board fits the screen width (portrait phones need more).
  fitRadius() {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const v = this.camera.view;
    // With a view offset the vertical FOV spans the larger virtual frame, so scale accordingly.
    const tanH = Math.tan(vfov / 2) * (v && v.enabled ? v.width / v.fullHeight : this.camera.aspect);
    return THREE.MathUtils.clamp(0.4 / tanH, 1.05, 2.8);
  }

  flipView() { this.setView(this.viewColor === 'w' ? 'b' : 'w'); }

  // ------------------------------------------------------------ per-frame
  update(dt, t) {
    this.time = t;
    // Tweens
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      if (a.t < 0) continue;
      const k = Math.min(1, a.t / a.dur);
      const e = ease(k);
      a.obj.position.lerpVectors(a.from, a.to, e);
      a.obj.position.y += Math.sin(Math.PI * k) * a.arc;
      const s = a.s0 + (a.s1 - a.s0) * e;
      a.obj.scale.setScalar(s);
      if (a.spin) a.obj.rotation.y = a.rot0 + e * Math.PI * 2;
      if (k >= 1) {
        a.obj.position.copy(a.to);
        this.anims.splice(i, 1);
        a.resolve();
      }
    }
    // Selected piece hovers gently
    for (const [sqi, obj] of this.pieces) {
      if (this.anims.some((a) => a.obj === obj)) continue;
      const lift = sqi === this.selected ? 0.22 + Math.sin(t * 4) * 0.04 : 0;
      obj.position.y += (lift - obj.position.y) * Math.min(1, dt * 12);
    }
    // Per-piece idle animations (banners, holograms…)
    for (const obj of this.pieces.values()) if (obj.userData.animate) obj.userData.animate(t);
    for (const c of ['w', 'b']) for (const obj of this.graves[c]) if (obj.userData.animate) obj.userData.animate(t);

    // Camera
    if (this.cinematic) {
      const a = t * 0.05 + 0.6;
      const r = 2.7;
      this.camera.position.set(Math.sin(a) * r, 1.55 + Math.sin(t * 0.13) * 0.15, Math.cos(a) * r);
      this.camera.lookAt(0, 0.95, 0);
    } else if (this.camTween) {
      const c = this.camTween;
      c.t += dt;
      const k = ease(Math.min(1, c.t / c.dur));
      const s = new THREE.Spherical(
        c.from.radius + (c.to.radius - c.from.radius) * k,
        c.from.phi + (c.to.phi - c.from.phi) * k,
        c.from.theta + (c.to.theta - c.from.theta) * k,
      );
      this.camera.position.setFromSpherical(s).add(this.controls.target);
      this.camera.lookAt(this.controls.target);
      if (c.t >= c.dur) this.camTween = null;
    }
    if (!this.cinematic) this.controls.update();
  }

  enterMenu() {
    this._requestId++;
    this.mode = 'menu';
    this.thinking = false;
    this.cinematic = true;
    this.hooks = {};
    this.board.clearHighlights();
    this.board.clearMoveMarkers();
    this.board.setStars([]);
    this.chess = new Chess();
    this.gameOver = null;
    this.syncAll();
    this.emit('change');
  }

  leaveCinematic() {
    if (!this.cinematic) return;
    this.cinematic = false;
  }
}
