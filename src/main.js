// Sherwood Chess — entry point.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { Environment, STUMP_TOP } from './scene/environment.js';
import { Board, BOARD_SCALE } from './scene/board.js';
import { GameController } from './game/controller.js';
import { UI } from './game/ui.js';
import { Tutorial } from './tutorial/tutorial.js';
import { AudioManager } from './audio.js';
import { PIECE_SETS, createPiece } from './pieces/index.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const ui = new UI();
  const quality = ui.settings.quality;
  ui.setLoading(0.05, 'Lighting the forest…');
  await frame();

  // ---------------------------------------------------------------- renderer
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    ui.setLoading(1, 'Sorry — your browser does not support WebGL, which this game needs.');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.getElementById('app').prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1200);
  camera.position.set(0, 1.6, 2.6);

  const boardTop = STUMP_TOP + 0.42 * BOARD_SCALE;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, boardTop, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 0.45;
  controls.maxDistance = 4.5;
  controls.maxPolarAngle = 1.48;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  ui.setLoading(0.15, 'Growing ancient oaks…');
  await frame();
  const env = new Environment(scene, renderer, { quality });
  ui.setLoading(0.7, 'Carving the chessboard…');
  await frame();
  const board = new Board(scene);
  const audio = new AudioManager();
  audio.setEnabled(ui.settings.sound);

  const ctrl = new GameController({ camera, renderer, controls, board, audio });
  ctrl.pieceSet = ui.settings.set;
  ctrl.showLegal = ui.settings.legal;
  ctrl.autoRotate = ui.settings.rotate;
  ctrl.syncAll();
  const tutorial = new Tutorial(ctrl, ui, audio);

  ui.setLoading(0.85, 'Summoning the pieces…');
  await frame();
  ui.thumbs = makeThumbnails(renderer, scene.environment);

  // ---------------------------------------------------------------- wiring
  const updateHud = () => { if (ctrl.mode === 'ai' || ctrl.mode === 'pvp') ui.updateHud(ctrl); };
  ctrl.addEventListener('change', updateHud);
  ctrl.addEventListener('toast', (e) => ui.toast(e.detail.text, e.detail.kind));
  ctrl.addEventListener('promotion', async (e) => e.detail.resolve(await ui.askPromotion(e.detail.color)));
  ctrl.addEventListener('gameover', async (e) => {
    updateHud();
    await new Promise((r) => setTimeout(r, 700));
    const choice = await ui.showGameOver(e.detail, ctrl);
    if (choice === 'again') startGame(ctrl.mode);
    if (choice === 'menu') goMenu();
  });

  const startAudio = () => { audio.start(); };
  window.addEventListener('pointerdown', startAudio, { once: false });

  function goMenu() {
    tutorial.stop();
    ui.closeModal();
    ui.showHud(false);
    ui.showTutorial(false);
    ctrl.enterMenu();
    ui.show('menu');
  }

  function startGame(mode) {
    ui.show(null);
    ui.showTutorial(false);
    applyViewOffset();
    tutorial.stop();
    let side = ui.settings.side;
    if (side === 'r') side = Math.random() < 0.5 ? 'w' : 'b';
    ctrl.autoRotate = ui.settings.rotate;
    ctrl.newGame({ mode, humanColor: side, level: ui.settings.level });
    ui.showHud(true);
    ui.updateHud(ctrl);
  }

  function openLessons() {
    ui.show('lessons');
    tutorial.renderIndex(document.getElementById('chapter-list'), (i) => startTutorial(i));
  }

  function startTutorial(i) {
    ui.show(null);
    ui.showHud(false);
    ui.showTutorial(true);
    tutorial.start(i);
    // Frame the board around the freshly rendered lesson card.
    applyViewOffset();
    ctrl.setView(ctrl.viewColor);
  }

  let backTarget = 'menu';
  ui.on('setup-ai', () => { backTarget = 'menu'; ui.openSetup('ai'); });
  ui.on('setup-pvp', () => { backTarget = 'menu'; ui.openSetup('pvp'); });
  ui.on('settings', () => { backTarget = 'menu'; ui.openSettings(); });
  ui.on('lessons', () => {
    backTarget = tutorial.active ? 'tutorial' : 'menu';
    openLessons();
  });
  ui.on('back', () => {
    if (backTarget === 'tutorial') { ui.show(null); return; }
    ui.show('menu');
  });
  ui.on('start', () => startGame(ui.setupMode));
  ui.on('menu', async () => {
    if ((ctrl.mode === 'ai' || ctrl.mode === 'pvp') && ctrl.chess.history.length && !ctrl.gameOver) {
      if (!(await ui.confirm('Leave this game and return to the main menu?', 'Leave'))) return;
    }
    goMenu();
  });
  ui.on('new', async () => {
    if (ctrl.chess.history.length && !ctrl.gameOver && !(await ui.confirm('Start a new game?', 'New game'))) return;
    startGame(ctrl.mode);
  });
  ui.on('undo', () => ctrl.undo());
  ui.on('hint', () => ctrl.hint());
  ui.on('flip', () => ctrl.flipView());
  ui.on('pieces', () => ui.showSetPicker());
  ui.on('set-picked', (id) => ctrl.setPieceSet(id));
  ui.on('sound', () => {
    ui.settings.sound = !ui.settings.sound;
    ui.saveSettings();
    audio.setEnabled(ui.settings.sound);
    ui._syncChecks();
  });
  ui.on('sound-set', (v) => audio.setEnabled(v));
  ui.on('legal-set', (v) => { ctrl.showLegal = v; });
  ui.on('rotate-set', (v) => { ctrl.autoRotate = v; });
  ui.on('lesson-hint', () => tutorial.hint());
  ui.on('lesson-restart', () => tutorial.restart());
  ui.on('lesson-next', () => tutorial.next());
  ui.on('lesson-prev', () => tutorial.prev());
  ui.on('lesson-collapse', () => {
    const card = document.getElementById('lesson-card');
    card.classList.toggle('collapsed');
    document.getElementById('collapse-btn').textContent = card.classList.contains('collapsed') ? '▸ Show' : '▾ Hide';
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { ctrl.deselect(); ui.closeModal(); }
    if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'u') { if (ctrl.mode === 'ai' || ctrl.mode === 'pvp') ctrl.undo(); }
    if (e.key === 'f') ctrl.flipView();
  });

  // Keep the board centred in the space left free by the lesson card.
  function applyViewOffset() {
    const w = window.innerWidth, h = window.innerHeight;
    const card = document.getElementById('lesson-card');
    const tutorialOn = !document.getElementById('tutorial').classList.contains('hidden');
    let sx = 0, sy = 0;
    if (tutorialOn && card) {
      if (w > 760) sx = Math.min((card.offsetWidth + 14) / 2, w * 0.25);
      else sy = Math.min(card.offsetHeight * 0.45, h * 0.25);
    }
    if (sx || sy) {
      camera.aspect = (w + 2 * sx) / (h + 2 * sy);
      camera.setViewOffset(w + 2 * sx, h + 2 * sy, 0, 0, w, h);
    } else {
      camera.clearViewOffset();
      camera.aspect = w / h;
    }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(applyViewOffset).observe(document.getElementById('lesson-card'));
  new MutationObserver(applyViewOffset).observe(document.getElementById('tutorial'), { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyViewOffset();
    if (!ctrl.cinematic) ctrl.setView(ctrl.viewColor);
  });

  // ---------------------------------------------------------------- loop
  const timer = new THREE.Timer();
  let elapsed = 0;
  const perf = { frames: 0, time: 0 };
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    elapsed += dt;
    // Adaptive resolution: drop the pixel ratio if the device struggles.
    perf.frames++; perf.time += dt;
    if (perf.time > 3) {
      const avg = perf.time / perf.frames;
      if (avg > 1 / 28 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5));
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
      perf.frames = 0; perf.time = 0;
    }
    env.update(dt, elapsed);
    board.update(dt);
    ctrl.update(dt, elapsed);
    renderer.render(scene, camera);
  });

  ui.setLoading(1, 'Welcome to Sherwood.');
  await frame();
  ui.show('menu');
  window.__sherwood = { ctrl, tutorial, ui, env, scene, camera, renderer };
}

// Render a small preview image for each piece set using the live renderer.
function makeThumbnails(renderer, envMap) {
  const W = 320, H = 200;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2f4426');
  scene.environment = envMap;
  scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight('#e8f0ff', '#2a3a1c', 1.2));
  const key = new THREE.DirectionalLight('#ffe7c0', 2.6);
  key.position.set(-2, 4, 3);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  cam.position.set(0, 1.5, 5.4);
  cam.lookAt(0, 0.65, 0);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshStandardMaterial({ color: '#5a3f26', roughness: 0.8 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const size = new THREE.Vector2();
  renderer.getSize(size);
  const dpr = renderer.getPixelRatio();
  const out = {};
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const prevShadow = renderer.shadowMap.enabled;
  for (const id of Object.keys(PIECE_SETS)) {
    const group = new THREE.Group();
    const lineup = [['b', 'q', -1.5], ['w', 'k', -0.5], ['w', 'n', 0.5], ['b', 'p', 1.5]];
    for (const [c, t, x] of lineup) {
      const p = createPiece(id, t, c);
      p.position.x = x;
      if (t === 'n') p.rotation.y = c === 'w' ? -Math.PI / 2 - 0.5 : Math.PI / 2;
      if (p.userData.animate) p.userData.animate(1.3);
      group.add(p);
    }
    scene.add(group);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, W / dpr, H / dpr);
    renderer.setScissor(0, 0, W / dpr, H / dpr);
    renderer.render(scene, cam);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(renderer.domElement, 0, renderer.domElement.height - H, W, H, 0, 0, W, H);
    out[id] = canvas.toDataURL('image/png');
    scene.remove(group);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.shadowMap.enabled = prevShadow;
  return out;
}

boot().catch((err) => {
  console.error(err);
  const t = document.getElementById('loading-text');
  if (t) t.textContent = 'Something went wrong while loading: ' + err.message;
});
