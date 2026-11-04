// Medieval figurines: footmen, castle towers, armoured warhorses, clergy and royalty.
import * as THREE from 'three';
import { cached, lathe, latheSharp, horseShape, extrudeShape, taperHorse, mesh, faceRotation } from './common.js';

const palettes = {
  w: { body: '#e4d8bd', cloth: '#2f5ea8', metal: '#c8ccd4', stone: '#d9d2c0', skin: '#e9c9a6', trim: '#d4a93a' },
  b: { body: '#2b2521', cloth: '#9a1f22', metal: '#4b4c52', stone: '#4a443e', skin: '#b08462', trim: '#c49a2c' },
};
const matCache = {};
function M(color, key) {
  const k = color + key;
  if (!matCache[k]) {
    const c = palettes[color][key];
    const metal = key === 'metal' || key === 'trim';
    matCache[k] = new THREE.MeshStandardMaterial({
      color: c,
      metalness: metal ? 0.85 : 0.0,
      roughness: metal ? 0.35 : key === 'stone' ? 0.9 : 0.7,
    });
  }
  return matCache[k];
}

const DARK = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.25 });

const PLINTH = [[0.38, 0], [0.38, 0.08], [0.34, 0.1], [0.34, 0.14], [0.3, 0.16]];

function plinth(color, root) {
  root.add(mesh(cached('med-plinth', () => latheSharp(PLINTH, 8)), M(color, 'stone')));
  const ring = mesh(cached('med-plinth-ring', () => new THREE.TorusGeometry(0.33, 0.018, 8, 8)), M(color, 'trim'));
  ring.rotation.x = Math.PI / 2;
  ring.rotation.z = Math.PI / 8;
  ring.position.y = 0.12;
  root.add(ring);
}

function head(color, y, r = 0.085) {
  const h = mesh(cached('med-head' + r, () => new THREE.SphereGeometry(r, 16, 12)), M(color, 'skin'));
  h.position.y = y;
  return h;
}

// A figure group oriented so local +z faces forward toward the enemy.
function figure(color) {
  const g = new THREE.Group();
  g.rotation.y = color === 'w' ? Math.PI : 0;
  return g;
}

function crown(color, y, r, spikes, h = 0.08) {
  const g = new THREE.Group();
  const band = mesh(cached(`med-crown-${r}`, () => new THREE.CylinderGeometry(r, r * 0.92, h * 0.6, 20, 1, true)), M(color, 'trim'));
  band.material.side = THREE.DoubleSide;
  band.position.y = y;
  g.add(band);
  const spikeGeo = cached('med-spike' + h, () => new THREE.ConeGeometry(0.022, h, 6));
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const s = mesh(spikeGeo, M(color, 'trim'));
    s.position.set(Math.cos(a) * r, y + h * 0.6, Math.sin(a) * r);
    g.add(s);
  }
  return g;
}

function buildPawn(color) {
  const root = new THREE.Group();
  plinth(color, root);
  const fig = figure(color);
  // Tunic
  fig.add(mesh(cached('med-p-body', () => lathe([[0.19, 0.15], [0.17, 0.25], [0.13, 0.4], [0.12, 0.5], [0.13, 0.56], [0.06, 0.62]])), M(color, 'cloth')));
  // Belt
  const belt = mesh(cached('med-belt', () => new THREE.TorusGeometry(0.128, 0.015, 6, 20)), M(color, 'body'));
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.4;
  fig.add(belt);
  fig.add(head(color, 0.69, 0.08));
  // Kettle helmet
  const helm = mesh(cached('med-kettle', () => new THREE.SphereGeometry(0.088, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M(color, 'metal'));
  helm.position.y = 0.7;
  const brim = mesh(cached('med-brim', () => new THREE.CylinderGeometry(0.13, 0.13, 0.012, 20)), M(color, 'metal'));
  brim.position.y = 0.705;
  fig.add(helm, brim);
  // Heater shield
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.1, 0.1); shieldShape.lineTo(0.1, 0.1); shieldShape.lineTo(0.1, 0.0);
  shieldShape.quadraticCurveTo(0.09, -0.1, 0, -0.15); shieldShape.quadraticCurveTo(-0.09, -0.1, -0.1, 0);
  shieldShape.lineTo(-0.1, 0.1);
  const shield = mesh(cached('med-shield', () => extrudeShape(shieldShape, 0.02, 0.008, 8)), M(color, 'body'));
  shield.position.set(-0.06, 0.4, 0.14);
  shield.rotation.y = -0.3;
  fig.add(shield);
  const boss = mesh(cached('med-boss', () => new THREE.SphereGeometry(0.03, 10, 6)), M(color, 'trim'));
  boss.position.set(-0.065, 0.4, 0.165);
  fig.add(boss);
  // Spear
  const shaft = mesh(cached('med-spear', () => new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6)), M(color, 'body'));
  shaft.position.set(0.17, 0.55, 0.04);
  const tip = mesh(cached('med-spear-tip', () => new THREE.ConeGeometry(0.025, 0.09, 6)), M(color, 'metal'));
  tip.position.set(0.17, 1.01, 0.04);
  fig.add(shaft, tip);
  root.add(fig);
  return root;
}

function buildRook(color) {
  const root = new THREE.Group();
  plinth(color, root);
  const stone = M(color, 'stone');
  root.add(mesh(cached('med-r-tower', () => latheSharp([[0.3, 0.14], [0.27, 0.2], [0.24, 0.85], [0.29, 0.9], [0.29, 0.98], [0.0, 0.98]], 12)), stone));
  // Stone courses
  for (const y of [0.35, 0.6]) {
    const ring = mesh(cached('med-course', () => new THREE.TorusGeometry(0.248, 0.01, 4, 12)), M(color, 'body'));
    ring.rotation.x = Math.PI / 2; ring.position.y = y;
    root.add(ring);
  }
  // Merlons
  const merlon = cached('med-merlon', () => new THREE.BoxGeometry(0.1, 0.13, 0.08));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = mesh(merlon, stone);
    m.position.set(Math.cos(a) * 0.255, 1.04, Math.sin(a) * 0.255);
    m.rotation.y = -a;
    root.add(m);
  }
  // Arched door and arrow slits
  const fig = figure(color);
  const door = mesh(cached('med-door', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.07, 0); s.lineTo(0.07, 0); s.lineTo(0.07, 0.12); s.absarc(0, 0.12, 0.07, 0, Math.PI, false); s.lineTo(-0.07, 0);
    return extrudeShape(s, 0.04, 0, 12);
  }), M(color, 'cloth'));
  door.position.set(0, 0.2, 0.245);
  door.rotation.x = -0.12;
  fig.add(door);
  const slitGeo = cached('med-slit', () => new THREE.BoxGeometry(0.03, 0.12, 0.05));
  for (const [x, y] of [[0, 0.62], [-0.12, 0.72], [0.12, 0.72]]) {
    const s = mesh(slitGeo, DARK);
    s.position.set(x, y, Math.sqrt(0.245 ** 2 - x * x));
    s.lookAt(new THREE.Vector3(x * 4, y, 1));
    fig.add(s);
  }
  // Banner
  const pole = mesh(cached('med-pole', () => new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6)), M(color, 'metal'));
  pole.position.set(0, 1.15, 0);
  const flag = mesh(cached('med-flag', () => {
    const g = new THREE.PlaneGeometry(0.2, 0.12, 6, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 25) * 0.015);
    g.translate(0.1, 0, 0);
    return g;
  }), M(color, 'cloth'));
  flag.material.side = THREE.DoubleSide;
  flag.position.set(0, 1.26, 0);
  flag.name = 'flag';
  fig.add(pole, flag);
  root.add(fig);
  root.userData.animate = (t) => { flag.rotation.y = Math.sin(t * 2.5) * 0.25; };
  return root;
}

function buildKnight(color) {
  const root = new THREE.Group();
  plinth(color, root);
  // Caparison skirt
  root.add(mesh(cached('med-n-skirt', () => lathe([[0.3, 0.14], [0.26, 0.22], [0.2, 0.32], [0.18, 0.36], [0.0, 0.37]])), M(color, 'cloth')));
  const pivot = new THREE.Group();
  pivot.rotation.y = faceRotation(color);
  const headGeo = cached('med-horse', () => {
    const g = taperHorse(extrudeShape(horseShape(), 0.18, 0.045));
    g.scale(0.92, 0.92, 1);
    g.translate(0, 0.33, 0);
    return g;
  });
  pivot.add(mesh(headGeo, M(color, 'body')));
  // Chanfron (armour plate on the face)
  const plate = mesh(cached('med-chanfron', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.2, -0.17); s.lineTo(0.26, -0.15); s.lineTo(0.08, 0.06); s.lineTo(0, 0);
    return extrudeShape(s, 0.24, 0.01, 4);
  }), M(color, 'metal'));
  plate.position.set(0.1, 1.0, 0);
  pivot.add(plate);
  // Mane plume
  const plume = mesh(cached('med-plume', () => new THREE.ConeGeometry(0.05, 0.22, 8)), M(color, 'cloth'));
  plume.position.set(-0.13, 1.25, 0);
  plume.rotation.z = 0.5;
  pivot.add(plume);
  // Reins
  const rein = mesh(cached('med-rein', () => new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI)), M(color, 'trim'));
  rein.position.set(0.12, 0.66, 0);
  rein.rotation.z = -0.9;
  pivot.add(rein);
  const eyeGeo = cached('med-eye', () => new THREE.SphereGeometry(0.022, 8, 6));
  for (const s of [-1, 1]) {
    const e = mesh(eyeGeo, DARK);
    e.position.set(0.15, 0.97, s * 0.11);
    pivot.add(e);
  }
  root.add(pivot);
  return root;
}

function buildBishop(color) {
  const root = new THREE.Group();
  plinth(color, root);
  const fig = figure(color);
  fig.add(mesh(cached('med-b-robe', () => lathe([[0.25, 0.15], [0.21, 0.3], [0.15, 0.6], [0.12, 0.8], [0.13, 0.86], [0.07, 0.92]])), M(color, 'body')));
  // Stole
  const stole = mesh(cached('med-stole', () => new THREE.BoxGeometry(0.06, 0.6, 0.02)), M(color, 'cloth'));
  stole.position.set(0, 0.55, 0.17);
  stole.rotation.x = -0.12;
  fig.add(stole);
  fig.add(head(color, 0.98, 0.08));
  // Mitre
  const mitre = mesh(cached('med-mitre', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.085, 0); s.lineTo(0.085, 0); s.quadraticCurveTo(0.09, 0.12, 0, 0.22); s.quadraticCurveTo(-0.09, 0.12, -0.085, 0);
    return extrudeShape(s, 0.12, 0.012, 10);
  }), M(color, 'cloth'));
  mitre.position.set(0, 1.03, 0);
  fig.add(mitre);
  const band = mesh(cached('med-mitre-band', () => new THREE.BoxGeometry(0.02, 0.2, 0.15)), M(color, 'trim'));
  band.position.set(0, 1.12, 0);
  fig.add(band);
  // Crozier
  const staff = mesh(cached('med-crozier', () => new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6)), M(color, 'trim'));
  staff.position.set(0.2, 0.68, 0.06);
  const hook = mesh(cached('med-hook', () => new THREE.TorusGeometry(0.05, 0.012, 6, 16, Math.PI * 1.5)), M(color, 'trim'));
  hook.position.set(0.2, 1.24, 0.06);
  hook.rotation.y = Math.PI / 2;
  fig.add(staff, hook);
  root.add(fig);
  return root;
}

function buildQueen(color) {
  const root = new THREE.Group();
  plinth(color, root);
  const fig = figure(color);
  fig.add(mesh(cached('med-q-gown', () => lathe([[0.29, 0.15], [0.25, 0.3], [0.17, 0.6], [0.11, 0.85], [0.11, 0.95], [0.15, 1.0], [0.07, 1.05]])), M(color, 'body')));
  // Cloak around the back
  const cloak = mesh(cached('med-cloak', () => new THREE.CylinderGeometry(0.15, 0.3, 0.85, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8)), M(color, 'cloth'));
  cloak.material.side = THREE.DoubleSide;
  cloak.position.y = 0.58;
  fig.add(cloak);
  const girdle = mesh(cached('med-girdle', () => new THREE.TorusGeometry(0.15, 0.015, 6, 20)), M(color, 'trim'));
  girdle.rotation.x = Math.PI / 2; girdle.position.y = 0.62;
  fig.add(girdle);
  fig.add(head(color, 1.12, 0.085));
  // Veil
  const veil = mesh(cached('med-veil', () => new THREE.SphereGeometry(0.1, 14, 10, Math.PI * 0.5, Math.PI, 0, Math.PI * 0.6)), M(color, 'cloth'));
  veil.material.side = THREE.DoubleSide;
  veil.position.y = 1.13;
  veil.rotation.y = Math.PI;
  fig.add(veil);
  fig.add(crown(color, 1.2, 0.08, 6, 0.09));
  // Sceptre
  const sc = mesh(cached('med-sceptre', () => new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6)), M(color, 'trim'));
  sc.position.set(0.18, 0.85, 0.12);
  sc.rotation.z = -0.15;
  const orb = mesh(cached('med-orb', () => new THREE.SphereGeometry(0.035, 10, 8)), M(color, 'cloth'));
  orb.position.set(0.215, 1.1, 0.12);
  fig.add(sc, orb);
  root.add(fig);
  return root;
}

function buildKing(color) {
  const root = new THREE.Group();
  plinth(color, root);
  const fig = figure(color);
  fig.add(mesh(cached('med-k-robe', () => lathe([[0.3, 0.15], [0.27, 0.3], [0.2, 0.6], [0.15, 0.9], [0.16, 1.0], [0.2, 1.06], [0.08, 1.12]])), M(color, 'body')));
  // Ermine-trimmed mantle
  const mantle = mesh(cached('med-mantle', () => new THREE.CylinderGeometry(0.2, 0.32, 0.95, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9)), M(color, 'cloth'));
  mantle.material.side = THREE.DoubleSide;
  mantle.position.y = 0.6;
  fig.add(mantle);
  const collar = mesh(cached('med-collar', () => new THREE.TorusGeometry(0.17, 0.035, 8, 24)), M('w', 'body'));
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.05;
  fig.add(collar);
  fig.add(head(color, 1.2, 0.09));
  fig.add(crown(color, 1.28, 0.09, 5, 0.1));
  const cv = mesh(cached('med-kcross-v', () => new THREE.BoxGeometry(0.03, 0.12, 0.03)), M(color, 'trim'));
  cv.position.y = 1.43;
  const ch = mesh(cached('med-kcross-h', () => new THREE.BoxGeometry(0.09, 0.03, 0.03)), M(color, 'trim'));
  ch.position.y = 1.45;
  fig.add(cv, ch);
  // Sword held point-down in front
  const blade = mesh(cached('med-blade', () => new THREE.BoxGeometry(0.035, 0.55, 0.012)), M(color, 'metal'));
  blade.position.set(0, 0.5, 0.25);
  const guard = mesh(cached('med-guard', () => new THREE.BoxGeometry(0.16, 0.025, 0.025)), M(color, 'trim'));
  guard.position.set(0, 0.79, 0.25);
  const grip = mesh(cached('med-grip', () => new THREE.CylinderGeometry(0.013, 0.013, 0.1, 6)), M(color, 'cloth'));
  grip.position.set(0, 0.85, 0.25);
  const pommel = mesh(cached('med-pommel', () => new THREE.SphereGeometry(0.022, 8, 6)), M(color, 'trim'));
  pommel.position.set(0, 0.91, 0.25);
  fig.add(blade, guard, grip, pommel);
  root.add(fig);
  return root;
}

const builders = { p: buildPawn, r: buildRook, n: buildKnight, b: buildBishop, q: buildQueen, k: buildKing };

export function buildMedieval(type, color) {
  return builders[type](color);
}
