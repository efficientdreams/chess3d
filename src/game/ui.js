// DOM user interface: menus, setup screens, HUD, modals and toasts.
import { PIECE_SETS } from '../pieces/index.js';
import { LEVELS } from '../chess/ai.js';
import { PIECE_VALUES } from '../chess/engine.js';

const $ = (id) => document.getElementById(id);
const GLYPH = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const LEVEL_BLURB = {
  1: 'A village lad — learning the game',
  2: 'A steady yeoman archer',
  3: 'A sworn knight — solid tactics',
  4: 'The Sheriff — cunning and strong',
  5: 'The Outlaw King — thinks deeply',
};
const SETTINGS_KEY = 'sherwood-chess.settings';

export class UI {
  constructor() {
    this.settings = Object.assign({ sound: true, legal: true, rotate: false, quality: 'high', set: 'classic', level: 2, side: 'w' }, this._loadSettings());
    this.thumbs = {};
    this.handlers = {};
    this.setupMode = 'ai';
    this._bind();
  }

  _loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
  }
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  on(action, fn) { this.handlers[action] = fn; }
  _fire(action, el) { if (this.handlers[action]) this.handlers[action](el); }

  _bind() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      this._fire(el.dataset.action, el);
    });
    $('side-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.settings.side = b.dataset.side;
      this._renderSide();
    });
    $('quality-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.q === this.settings.quality) return;
      this.settings.quality = b.dataset.q;
      this.saveSettings();
      location.reload();
    });
    const bindCheck = (id, key, cb) => {
      const el = $(id);
      el.checked = !!this.settings[key];
      el.addEventListener('change', () => {
        this.settings[key] = el.checked;
        this.saveSettings();
        this._syncChecks();
        if (cb) cb(el.checked);
      });
    };
    bindCheck('opt-sound', 'sound', (v) => this._fire('sound-set', v));
    bindCheck('opt-legal', 'legal', (v) => this._fire('legal-set', v));
    bindCheck('opt-rotate', 'rotate', (v) => this._fire('rotate-set', v));
    bindCheck('opt-rotate2', 'rotate', (v) => this._fire('rotate-set', v));
  }

  _syncChecks() {
    $('opt-sound').checked = this.settings.sound;
    $('opt-legal').checked = this.settings.legal;
    $('opt-rotate').checked = this.settings.rotate;
    $('opt-rotate2').checked = this.settings.rotate;
    document.querySelectorAll('[data-action="sound"]').forEach((b) => { b.firstChild.textContent = this.settings.sound ? '🔊' : '🔇'; });
    [...$('quality-seg').children].forEach((b) => b.classList.toggle('on', b.dataset.q === this.settings.quality));
  }

  // ------------------------------------------------------------ screens
  show(name) {
    for (const id of ['loading', 'menu', 'setup', 'settings', 'lessons']) $(id).classList.toggle('show', id === name);
  }
  showHud(on) { $('hud').classList.toggle('hidden', !on); }
  showTutorial(on) { $('tutorial').classList.toggle('hidden', !on); }

  setLoading(frac, text) {
    $('loading-bar').style.width = `${Math.round(frac * 100)}%`;
    if (text) $('loading-text').textContent = text;
  }

  openSetup(mode) {
    this.setupMode = mode;
    $('setup-title').textContent = mode === 'ai' ? 'Play the Computer' : 'Two Players';
    $('setup-ai-only').classList.toggle('hidden', mode !== 'ai');
    $('setup-pvp-only').classList.toggle('hidden', mode !== 'pvp');
    this._renderSide();
    this._renderLevels();
    this.renderSets($('set-list'));
    this._syncChecks();
    this.show('setup');
  }

  openSettings() {
    this.renderSets($('set-list-2'));
    this._syncChecks();
    this.show('settings');
  }

  _renderSide() {
    [...$('side-seg').children].forEach((b) => b.classList.toggle('on', b.dataset.side === this.settings.side));
  }

  _renderLevels() {
    const box = $('level-list');
    box.innerHTML = '';
    for (const [lvl, cfg] of Object.entries(LEVELS)) {
      const b = document.createElement('button');
      b.className = 'level' + (Number(lvl) === this.settings.level ? ' on' : '');
      b.innerHTML = `<b>${cfg.name}</b><span>${LEVEL_BLURB[lvl]}</span>`;
      b.onclick = () => { this.settings.level = Number(lvl); this.saveSettings(); this._renderLevels(); };
      box.appendChild(b);
    }
  }

  renderSets(box, onPick) {
    box.innerHTML = '';
    for (const [id, set] of Object.entries(PIECE_SETS)) {
      const b = document.createElement('button');
      b.className = 'set-card' + (id === this.settings.set ? ' on' : '');
      b.title = set.blurb;
      b.innerHTML = `${this.thumbs[id] ? `<img alt="" src="${this.thumbs[id]}">` : '<img alt="">'}<div>${set.name}</div>`;
      b.onclick = () => {
        this.settings.set = id;
        this.saveSettings();
        this.renderSets(box, onPick);
        this._fire('set-picked', id);
        if (onPick) onPick(id);
      };
      box.appendChild(b);
    }
  }

  // ------------------------------------------------------------ HUD
  updateHud(ctrl) {
    const c = ctrl.chess;
    const turn = c.turn;
    $('turn-chip').className = 'chip ' + turn;
    const names = { w: 'White', b: 'Black' };
    let who = names[turn];
    if (ctrl.mode === 'ai') who = ctrl.humanColors.has(turn) ? `You (${names[turn]})` : `Computer (${names[turn]})`;
    $('turn-text').textContent = ctrl.gameOver ? 'Game over' : `${who} to move`;
    let status = '';
    if (ctrl.gameOver) status = describeResult(ctrl.gameOver, ctrl);
    else if (c.inCheck()) status = 'Check!';
    $('status-text').textContent = status;
    $('thinking').classList.toggle('hidden', !ctrl.thinking);
    $('opponent-label').textContent = ctrl.mode === 'ai' ? `vs ${LEVELS[ctrl.aiLevel].name}` : ctrl.mode === 'pvp' ? 'Two players' : '';

    // Move list
    const list = $('move-list');
    const sans = c.pgnMoves();
    list.innerHTML = '';
    const firstBlack = c.history.length && c.history[0].move.color === 'b';
    const offset = firstBlack ? 1 : 0;
    for (let i = 0; i < sans.length + offset; i += 2) {
      const li = document.createElement('li');
      const a = i - offset >= 0 ? sans[i - offset] : '…';
      const b = sans[i + 1 - offset] || '';
      const lastIdx = sans.length - 1;
      li.innerHTML = `<span class="${i - offset === lastIdx ? 'last' : ''}">${a}</span><span class="${i + 1 - offset === lastIdx ? 'last' : ''}">${b}</span>`;
      list.appendChild(li);
    }
    list.scrollTop = list.scrollHeight;
    $('side-panel').classList.toggle('empty', c.history.length === 0);

    // Captured material
    const caps = { w: [], b: [] };
    for (const h of c.history) if (h.move.captured) caps[h.move.color].push(h.move.captured);
    const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    const score = (arr) => arr.reduce((s, t) => s + PIECE_VALUES[t], 0);
    const diff = score(caps.w) - score(caps.b);
    const fmt = (capturer) => caps[capturer].sort((a, b) => order[a] - order[b]).map((t) => GLYPH[capturer === 'w' ? 'b' : 'w'][t]).join('');
    $('cap-w').innerHTML = fmt('w') + (diff > 0 ? `<span class="adv">+${diff}</span>` : '');
    $('cap-b').innerHTML = fmt('b') + (diff < 0 ? `<span class="adv">+${-diff}</span>` : '');

    const humanTurn = ctrl.isHumanTurn() && !ctrl.thinking;
    document.querySelector('#toolbar [data-action="undo"]').disabled = c.history.length === 0 || ctrl.busy;
    document.querySelector('#toolbar [data-action="hint"]').disabled = !humanTurn;
  }

  // ------------------------------------------------------------ modals
  modal(html, { dismissable = true } = {}) {
    const box = $('modal-box');
    box.innerHTML = html;
    $('modal').classList.remove('hidden');
    $('modal').onclick = (e) => { if (dismissable && e.target.id === 'modal') this.closeModal(); };
    return box;
  }
  closeModal() { $('modal').classList.add('hidden'); }

  askPromotion(color) {
    return new Promise((resolve) => {
      const box = this.modal(`<h2>Promote your pawn</h2><p class="fell">Choose the piece your pawn becomes.</p>
        <div class="promo">${['q', 'r', 'b', 'n'].map((t) => `<button data-p="${t}">${GLYPH[color][t]}<small>${{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[t]}</small></button>`).join('')}</div>`, { dismissable: false });
      box.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { this.closeModal(); resolve(b.dataset.p); }; });
    });
  }

  showGameOver(st, ctrl) {
    const youWon = ctrl.mode === 'ai' && st.winner && ctrl.humanColors.has(st.winner);
    const youLost = ctrl.mode === 'ai' && st.winner && !ctrl.humanColors.has(st.winner);
    const title = st.result === '1/2-1/2' ? 'A Draw' : youWon ? 'Victory!' : youLost ? 'Defeat' : `${st.winner === 'w' ? 'White' : 'Black'} Wins!`;
    const flavour = youWon ? 'The greenwood rings with your praise. Even the Sheriff tips his hat.'
      : youLost ? 'The forest will remember this battle. Try again — or step down a level.'
        : st.result === '1/2-1/2' ? 'Honour is shared beneath the old oak.' : 'A worthy battle under the greenwood tree.';
    const box = this.modal(`<h2>${title}</h2><p><b>${describeResult(st, ctrl)}</b></p><p class="fell">${flavour}</p>
      <div class="row end" style="justify-content:center">
        <button class="btn ghost" data-m="review">Review board</button>
        <button class="btn" data-m="menu">Main menu</button>
        <button class="btn primary" data-m="again">Play again</button>
      </div>`);
    if (youWon || (st.winner && ctrl.mode === 'pvp')) this.confetti();
    return new Promise((resolve) => {
      box.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { this.closeModal(); resolve(b.dataset.m); }; });
    });
  }

  showSetPicker(onPick) {
    const box = this.modal('<h2>Choose your pieces</h2><div class="sets modal-sets" id="modal-sets"></div><div class="row end" style="justify-content:center"><button class="btn primary" data-m="close">Done</button></div>');
    this.renderSets(box.querySelector('#modal-sets'), onPick);
    box.querySelector('[data-m="close"]').onclick = () => this.closeModal();
  }

  confirm(text, yes = 'Yes', no = 'Cancel') {
    return new Promise((resolve) => {
      const box = this.modal(`<p>${text}</p><div class="row" style="justify-content:center"><button class="btn ghost" data-m="no">${no}</button><button class="btn primary" data-m="yes">${yes}</button></div>`);
      box.querySelector('[data-m="yes"]').onclick = () => { this.closeModal(); resolve(true); };
      box.querySelector('[data-m="no"]').onclick = () => { this.closeModal(); resolve(false); };
    });
  }

  toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    const box = $('toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; }, 2600);
    setTimeout(() => t.remove(), 3100);
  }

  confetti() {
    const colors = ['#d9ad43', '#4a7a3a', '#a2321f', '#f3d27a', '#2f5ea8', '#f6eedb'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * 0.4 + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.getElementById('app').appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }
}

export function describeResult(st, ctrl) {
  const names = { w: 'White', b: 'Black' };
  if (st.reason === 'checkmate') {
    if (ctrl && ctrl.mode === 'ai') return ctrl.humanColors.has(st.winner) ? 'Checkmate — you win!' : 'Checkmate — the computer wins.';
    return `Checkmate — ${names[st.winner]} wins.`;
  }
  if (st.reason === 'resignation') return `${names[st.winner]} wins by resignation.`;
  return `Draw by ${st.reason}.`;
}
