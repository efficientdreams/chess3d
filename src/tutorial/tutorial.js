// Runs the interactive lessons on the live 3D board.
import { Chess, sq, sqName, other } from '../chess/engine.js';
import { LESSONS, CHAPTERS } from './lessons.js';

const STORE_KEY = 'sherwood-chess.lessons';
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProgress() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')); } catch { return new Set(); }
}
function saveProgress(set) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

export class Tutorial {
  constructor(ctrl, ui, audio) {
    this.ctrl = ctrl;
    this.ui = ui;
    this.audio = audio;
    this.progress = loadProgress();
    this.index = 0;
    this.token = 0;
    this.active = false;
    this.stars = new Map(); // lessonId -> best rating
  }

  get lesson() { return LESSONS[this.index]; }

  nextIncompleteIndex() {
    const i = LESSONS.findIndex((l) => !this.progress.has(l.id));
    return i < 0 ? 0 : i;
  }

  start(i = this.nextIncompleteIndex()) {
    this.active = true;
    this.index = Math.max(0, Math.min(LESSONS.length - 1, i));
    this.load();
  }

  stop() {
    this.active = false;
    this.token++;
    this.ctrl.board.setStars([]);
    this.ctrl.board.clearHighlights();
  }

  restart() { this.load(); }
  next() { if (this.index < LESSONS.length - 1) { this.index++; this.load(); } }
  prev() { if (this.index > 0) { this.index--; this.load(); } }

  load() {
    const l = this.lesson;
    const token = ++this.token;
    this.state = { item: 0, moves: 0, step: 0, done: false, playerMoves: 0, left: new Set((l.stars || []).map(sq)), token };
    const side = l.side || 'w';
    this.side = side;
    const hooks = {
      onSquareClick: (i) => this._onSquareClick(i),
      canSelect: (i) => this._canSelect(i),
      afterMove: (m) => this._afterMove(m, token),
      onIllegal: (from, to) => (l.illegal ? l.illegal(from, to) : null),
    };
    this.ctrl.loadPosition(l.fen, { humanColor: side, hooks });
    this.ctrl.board.clearHighlights();
    if (l.type === 'stars') {
      const occupied = [...this.state.left].filter((s) => this.ctrl.chess.board[s]);
      this.ctrl.board.setStars([...this.state.left], occupied);
    } else this.ctrl.board.setStars([]);
    this.ctrl.inputEnabled = true;

    const chapter = CHAPTERS.find((c) => c.id === l.chapter);
    $('lesson-chapter').textContent = `${chapter.icon} ${chapter.title} · Lesson ${this.index + 1} of ${LESSONS.length}`;
    $('lesson-title').textContent = l.title;
    $('lesson-intro').innerHTML = l.intro;
    $('lesson-card').classList.remove('done');
    $('next-btn').classList.toggle('primary', this.progress.has(l.id));
    $('next-btn').disabled = this.index >= LESSONS.length - 1;
    document.querySelector('[data-action="lesson-prev"]').disabled = this.index === 0;
    this._feedback('');
    this._renderGoal();
    this._renderProgress();
  }

  // ------------------------------------------------------------------ rendering
  _renderGoal() {
    const l = this.lesson;
    let html = `🎯 ${l.goal}`;
    if (l.type === 'squares' && !this.state.done) html += `<span class="prompt">${l.items[this.state.item].prompt}</span>`;
    $('lesson-goal').innerHTML = html;
  }

  _renderProgress() {
    const l = this.lesson, s = this.state;
    let html = '';
    if (l.type === 'squares') html = `Found ${s.item} of ${l.items.length}`;
    if (l.type === 'stars') {
      const got = l.stars.length - s.left.size;
      html = `<span class="stars">${'★'.repeat(got)}${'☆'.repeat(s.left.size)}</span> &nbsp; Moves: ${s.moves} (par ${l.par})`;
    }
    if (l.type === 'play') {
      html = `Your moves: ${s.playerMoves} / ${l.maxMoves}`;
      if (l.checklist) {
        html += '<ul>' + l.checklist(this.ctrl.chess).map((c) => `<li class="${c.done ? 'done' : ''}">${c.label}</li>`).join('') + '</ul>';
      }
    }
    if (l.type === 'task' && l.steps.length > 1) html = `Step ${Math.min(s.step + 1, l.steps.length)} of ${l.steps.length}`;
    $('lesson-progress').innerHTML = html;
  }

  _feedback(text, kind = '') {
    const el = $('lesson-feedback');
    el.innerHTML = text;
    el.className = 'fell ' + kind;
  }

  // ------------------------------------------------------------------ hooks
  _canSelect(i) {
    const l = this.lesson;
    if (this.state.done) return false;
    const p = this.ctrl.chess.board[i];
    if (l.movable && p && !l.movable.includes(p.t)) {
      this._feedback(`In this drill only the ${l.movable.map((t) => ({ r: 'rook', n: 'knight', q: 'queen', b: 'bishop', k: 'king', p: 'pawn' })[t]).join(' / ')} may move.`, 'bad');
      return false;
    }
    return true;
  }

  _onSquareClick(i) {
    const l = this.lesson;
    if (l.type !== 'squares') {
      if (this.state.done) return true;
      return false;
    }
    if (this.state.done) return true;
    const item = l.items[this.state.item];
    const name = sqName(i);
    if (item.answers.includes(name)) {
      this.ctrl.board.setHighlights('quiz-ok', [i], '#5fd35f', 0.6, 0.009);
      this.audio.star();
      this.state.item++;
      this._feedback(`✔ ${name} — correct!`, 'good');
      if (this.state.item >= l.items.length) this._complete();
      else { this._renderGoal(); }
      this._renderProgress();
    } else {
      this.ctrl.board.setHighlights('quiz-bad', [i], '#ff5a3c', 0.6, 0.009);
      const p = this.ctrl.chess.board[i];
      const what = p ? ` (a ${p.c === 'w' ? 'white' : 'black'} ${{ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[p.t]})` : '';
      this._feedback(`That's <b>${name}</b>${what}. Files are letters (left→right), ranks are numbers (bottom→top). Try again!`, 'bad');
      this.audio.wrong();
      setTimeout(() => this.ctrl.board.clearHighlights('quiz-bad'), 700);
    }
    return true;
  }

  async _afterMove(m, token) {
    if (token !== this.token) return;
    const l = this.lesson;
    const mine = m.color === this.side;
    if (l.type === 'stars') return this._afterStarMove(m);
    if (l.type === 'task') { if (mine) await this._afterTaskMove(m, token); return; }
    if (l.type === 'play') await this._afterPlayMove(m, token, mine);
  }

  _afterStarMove(m) {
    const s = this.state, l = this.lesson;
    s.moves++;
    if (s.left.has(m.to)) {
      s.left.delete(m.to);
      this.ctrl.board.collectStar(m.to);
      this.audio.star();
    }
    // Your opponent never moves in drills: hand the turn straight back.
    this.ctrl.setTurn(this.side);
    this._renderProgress();
    if (s.left.size === 0) {
      const rating = s.moves <= l.par ? 3 : s.moves <= l.par + 2 ? 2 : 1;
      const msg = rating === 3 ? `Perfect — ${s.moves} moves, right on par!` : `All stars collected in ${s.moves} moves. Can you do it in ${l.par}?`;
      this._complete(`${'★'.repeat(rating)}${'☆'.repeat(3 - rating)} ${msg}`);
    } else if (s.moves > l.par + 6) {
      this._feedback('Taking the scenic route? Press 💡 Hint for the shortest path.', '');
    } else this._feedback('');
  }

  async _afterTaskMove(m, token) {
    const l = this.lesson, s = this.state;
    const step = l.steps[s.step];
    const res = step.accept(m, this.ctrl.chess);
    if (res === true) {
      s.step++;
      this.audio.star();
      if (s.step >= l.steps.length) { this._complete(); return; }
      this._feedback('✔ Good move!', 'good');
      this._renderProgress();
      if (step.reply) {
        this.ctrl.inputEnabled = false;
        await wait(500);
        if (token !== this.token) return;
        const reply = step.reply === 'engine' ? await this.ctrl.askEngine(4) : this._uciMove(step.reply);
        if (token !== this.token) return;
        if (reply) await this.ctrl.playMove(reply);
        this.ctrl.inputEnabled = true;
        this._feedback('Your move again!', '');
      } else {
        this.ctrl.setTurn(this.side);
      }
      return;
    }
    // Wrong move: explain, optionally show the punishment, then take it back.
    const fail = typeof res === 'string' ? { fail: res } : res;
    this._feedback('✘ ' + fail.fail, 'bad');
    this.audio.wrong();
    this.ctrl.inputEnabled = false;
    let undo = 1;
    if (fail.reply) {
      await wait(700);
      if (token !== this.token) return;
      await this.ctrl.playMove(fail.reply);
      undo = 2;
      await wait(1600);
    } else await wait(1300);
    if (token !== this.token) return;
    this.ctrl.revert(undo);
    this.ctrl.inputEnabled = true;
  }

  async _afterPlayMove(m, token, mine) {
    const l = this.lesson, s = this.state;
    const chess = this.ctrl.chess;
    if (mine) s.playerMoves++;
    this._renderProgress();
    const st = chess.status();
    if (st && st.reason === 'checkmate' && st.winner === this.side) { this._complete(); return; }
    if (l.goalCheck && l.goalCheck(chess, m) === 'success') { this._complete(); return; }
    if (l.checklist && l.checklist(chess).every((c) => c.done)) { this._complete(); return; }
    if (st) {
      const why = st.reason === 'stalemate' ? 'Stalemate — the king had no moves but wasn’t in check. That’s a draw!'
        : st.reason === 'insufficient material' ? 'Not enough material left to checkmate — it’s a draw.'
          : `The game ended (${st.reason}).`;
      return this._failRestart(why, token);
    }
    if (!mine) { this.ctrl.inputEnabled = true; return; }
    if (s.playerMoves >= l.maxMoves) {
      return this._failRestart(`Out of moves! You had ${l.maxMoves}. Try again — press 💡 Hint if you get stuck.`, token);
    }
    // Computer replies
    this.ctrl.inputEnabled = false;
    this.ctrl.thinking = true;
    this.ctrl.emit('change');
    const [reply] = await Promise.all([this.ctrl.askEngine(l.engineLevel || 3), wait(450)]);
    if (token !== this.token) return;
    this.ctrl.thinking = false;
    if (reply) await this.ctrl.playMove(reply);
    this.ctrl.inputEnabled = true;
    this.ctrl.emit('change');
  }

  async _failRestart(msg, token) {
    this._feedback('✘ ' + msg, 'bad');
    this.audio.wrong();
    this.ctrl.inputEnabled = false;
    await wait(2600);
    if (token !== this.token) return;
    this.load();
  }

  _uciMove(u) {
    return { from: sq(u.slice(0, 2)), to: sq(u.slice(2, 4)), promotion: u[4] };
  }

  _complete(extra) {
    const l = this.lesson;
    this.state.done = true;
    this.ctrl.inputEnabled = l.type === 'squares';
    this.progress.add(l.id);
    saveProgress(this.progress);
    this.audio.success();
    this.ui.confetti();
    const last = this.index >= LESSONS.length - 1;
    this._feedback(`🏆 ${extra || l.success || 'Lesson complete!'}${last ? '<br>You have finished every lesson — now challenge the computer!' : ''}`, 'good');
    $('lesson-card').classList.add('done');
    $('next-btn').classList.add('primary');
    this._renderGoal();
    this._renderProgress();
  }

  // ------------------------------------------------------------------ hints
  async hint() {
    const l = this.lesson, s = this.state;
    if (s.done) { this._feedback('Lesson complete! Press Next to continue.', 'good'); return; }
    const board = this.ctrl.board;
    if (l.type === 'squares') {
      const ans = l.items[s.item].answers.map(sq);
      board.setHighlights('hint', ans, '#4fd1ff', 0.6, 0.008);
      return;
    }
    if (l.type === 'stars') {
      const mv = this._starPath();
      if (mv) {
        board.setHighlights('hint', [mv.from, mv.to], '#4fd1ff', 0.6, 0.008);
        this._feedback(`Try moving from <b>${sqName(mv.from)}</b> to <b>${sqName(mv.to)}</b>.`);
      }
      return;
    }
    if (l.type === 'task') {
      const u = l.steps[s.step].solution;
      const from = sq(u.slice(0, 2)), to = sq(u.slice(2, 4));
      board.setHighlights('hint', [from, to], '#4fd1ff', 0.6, 0.008);
      const p = this.ctrl.chess.board[from];
      const name = p ? { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[p.t] : 'piece';
      this._feedback(`Hint: move your <b>${name}</b> from <b>${sqName(from)}</b>…`);
      return;
    }
    if (l.type === 'play') {
      if (!this.ctrl.isHumanTurn() || this.ctrl.busy || this.ctrl.thinking) return;
      const token = this.token;
      this._feedback('Thinking of a good move…');
      const res = await this.ctrl.askEngine(5);
      if (token !== this.token || !res) return;
      board.setHighlights('hint', [res.from, res.to], '#4fd1ff', 0.6, 0.008);
      this._feedback(`Hint: <b>${sqName(res.from)}</b> → <b>${sqName(res.to)}</b>`);
    }
  }

  // Breadth-first search for the shortest route through the remaining stars.
  _starPath() {
    const l = this.lesson;
    const startFen = this.ctrl.chess.fen();
    const start = { fen: startFen, left: [...this.state.left], first: null };
    let frontier = [start];
    const seen = new Set();
    let best = null;
    for (let depth = 0; depth < 7 && frontier.length && !best; depth++) {
      const next = [];
      for (const st of frontier) {
        const g = new Chess(st.fen);
        for (const m of g.moves()) {
          if (l.movable && !l.movable.includes(m.piece)) continue;
          const left = st.left.filter((x) => x !== m.to);
          const first = st.first || { from: m.from, to: m.to };
          if (!left.length) { best = first; break; }
          g._make(m);
          g.turn = this.side; g.ep = -1;
          const fen = g.fen();
          g.load(st.fen);
          const key = fen.split(' ')[0] + '|' + left.join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ fen, left, first });
        }
        if (best) break;
        if (next.length > 20000) break;
      }
      frontier = next;
    }
    return best;
  }

  // ------------------------------------------------------------------ lesson index
  renderIndex(container, onPick) {
    container.innerHTML = '';
    for (const ch of CHAPTERS) {
      const wrap = document.createElement('div');
      wrap.className = 'chapter';
      wrap.innerHTML = `<h3><span>${ch.icon}</span> ${ch.title}</h3>`;
      const grid = document.createElement('div');
      grid.className = 'lesson-grid';
      LESSONS.forEach((l, i) => {
        if (l.chapter !== ch.id) return;
        const b = document.createElement('button');
        b.className = 'lesson-tile' + (this.progress.has(l.id) ? ' done' : '');
        b.innerHTML = `<small>Lesson ${i + 1}</small>${l.title}`;
        b.onclick = () => onPick(i);
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
      container.appendChild(wrap);
    }
    $('lesson-progress-total').textContent = `${this.progress.size} of ${LESSONS.length} lessons complete`;
  }
}

export { LESSONS, other };
