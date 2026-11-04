// Cyberpunk set: gunmetal chassis, neon light strips, hovering holographic parts.
import * as THREE from 'three';
import { cached, latheSharp, angularHorseShape, extrudeShape, mesh, faceRotation } from './common.js';

const NEON = { w: '#29f2ff', b: '#ff2bd6' };
const mats = {};
function chassis(color) {
  const k = 'c' + color;
  if (!mats[k]) {
    mats[k] = color === 'w'
      ? new THREE.MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.45, roughness: 0.32 })
      : new THREE.MeshStandardMaterial({ color: '#17151c', metalness: 0.8, roughness: 0.35 });
  }
  return mats[k];
}
function neon(color) {
  const k = 'n' + color;
  if (!mats[k]) mats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON[color]).multiplyScalar(1.6), toneMapped: false });
  return mats[k];
}
function holo(color) {
  const k = 'h' + color;
  if (!mats[k]) {
    mats[k] = new THREE.MeshStandardMaterial({
      color: NEON[color], emissive: NEON[color], emissiveIntensity: 0.9, transparent: true, opacity: 0.55,
      metalness: 0.1, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide,
    });
  }
  return mats[k];
}
function lines(color) {
  const k = 'l' + color;
  if (!mats[k]) mats[k] = new THREE.LineBasicMaterial({ color: NEON[color], toneMapped: false, transparent: true, opacity: 0.9 });
  return mats[k];
}

function edges(geo, color, threshold = 25) {
  const e = new THREE.LineSegments(cached('edges-' + geo.uuid, () => new THREE.EdgesGeometry(geo, threshold)), lines(color));
  return e;
}

function hexBase(color, root, r = 0.36) {
  const g = cached('cy-base' + r, () => latheSharp([[r, 0], [r, 0.07], [r - 0.04, 0.11], [0, 0.11]], 6));
  const b = mesh(g, chassis(color));
  root.add(b);
  const strip = mesh(cached('cy-strip' + r, () => new THREE.TorusGeometry(r - 0.015, 0.012, 4, 6)), neon(color));
  strip.rotation.x = Math.PI / 2;
  strip.rotation.z = Math.PI / 6;
  strip.position.y = 0.075;
  root.add(strip);
  root.add(edges(g, color));
}

function floater(root, obj, baseY, amp = 0.03, speed = 2, spin = 0) {
  obj.position.y = baseY;
  root.add(obj);
  const phase = Math.random() * Math.PI * 2;
  const prev = root.userData.animate;
  root.userData.animate = (t) => {
    if (prev) prev(t);
    obj.position.y = baseY + Math.sin(t * speed + phase) * amp;
    if (spin) obj.rotation.y = t * spin;
  };
}

export function buildCyberpunk(type, color) {
  const root = new THREE.Group();
  const C = chassis(color), N = neon(color), H = holo(color);
  switch (type) {
    case 'p': {
      hexBase(color, root, 0.3);
      const colG = cached('cy-p-col', () => latheSharp([[0.12, 0.11], [0.09, 0.42], [0.12, 0.46], [0, 0.46]], 6));
      root.add(mesh(colG, C), edges(colG, color));
      const core = new THREE.Group();
      const oct = mesh(cached('cy-p-oct', () => new THREE.OctahedronGeometry(0.13, 0)), H);
      core.add(oct, edges(oct.geometry, color, 1));
      floater(root, core, 0.66, 0.035, 2.2, 1.2);
      break;
    }
    case 'r': {
      hexBase(color, root);
      const tG = cached('cy-r', () => latheSharp([[0.27, 0.11], [0.24, 0.2], [0.24, 0.82], [0.29, 0.86], [0.29, 0.98], [0, 0.98]], 6));
      root.add(mesh(tG, C), edges(tG, color));
      const slit = cached('cy-r-slit', () => new THREE.BoxGeometry(0.035, 0.42, 0.02));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const s = mesh(slit, N);
        s.position.set(Math.cos(a) * 0.212, 0.5, Math.sin(a) * 0.212);
        s.rotation.y = -a + Math.PI / 2;
        root.add(s);
      }
      const ringG = cached('cy-r-ring', () => new THREE.TorusGeometry(0.2, 0.012, 6, 32));
      const ring = mesh(ringG, N);
      ring.rotation.x = Math.PI / 2;
      floater(root, ring, 1.08, 0.025, 2.5);
      break;
    }
    case 'n': {
      hexBase(color, root);
      const pivot = new THREE.Group();
      pivot.rotation.y = faceRotation(color);
      const hg = cached('cy-horse', () => {
        const g = extrudeShape(angularHorseShape(), 0.2, 0, 1);
        g.translate(0, 0.14, 0);
        return g;
      });
      pivot.add(mesh(hg, C), edges(hg, color, 10));
      const visor = mesh(cached('cy-visor', () => new THREE.BoxGeometry(0.2, 0.04, 0.24)), N);
      visor.position.set(0.18, 0.86, 0);
      visor.rotation.z = -0.55;
      pivot.add(visor);
      const mane = cached('cy-mane', () => new THREE.BoxGeometry(0.03, 0.08, 0.06));
      for (let i = 0; i < 4; i++) {
        const m = mesh(mane, N);
        m.position.set(-0.3 + i * 0.03, 0.62 + i * 0.12, 0);
        m.rotation.z = -0.4;
        pivot.add(m);
      }
      root.add(pivot);
      break;
    }
    case 'b': {
      hexBase(color, root);
      const bG = cached('cy-b', () => latheSharp([[0.2, 0.11], [0.15, 0.6], [0.12, 0.7], [0, 0.7]], 6));
      root.add(mesh(bG, C), edges(bG, color));
      const spire = new THREE.Group();
      const sp = mesh(cached('cy-b-spire', () => { const g = new THREE.OctahedronGeometry(0.14, 0); g.scale(1, 2.2, 1); return g; }), H);
      spire.add(sp, edges(sp.geometry, color, 1));
      floater(root, spire, 1.02, 0.03, 1.8, 0.8);
      const ring = mesh(cached('cy-b-ring', () => new THREE.TorusGeometry(0.2, 0.01, 6, 40)), N);
      ring.rotation.x = Math.PI / 2 + 0.4;
      root.add(ring);
      ring.position.y = 0.95;
      const prev = root.userData.animate;
      root.userData.animate = (t) => { prev(t); ring.rotation.z = t * 1.5; };
      break;
    }
    case 'q': {
      hexBase(color, root, 0.38);
      const qG = cached('cy-q', () => latheSharp([[0.22, 0.11], [0.13, 0.85], [0.19, 0.95], [0.19, 1.0], [0, 1.0]], 8));
      root.add(mesh(qG, C), edges(qG, color));
      const core = new THREE.Group();
      const ico = mesh(cached('cy-q-core', () => new THREE.IcosahedronGeometry(0.11, 0)), H);
      core.add(ico, edges(ico.geometry, color, 1));
      floater(root, core, 1.22, 0.03, 1.6, 1.0);
      const r1 = mesh(cached('cy-q-r1', () => new THREE.TorusGeometry(0.19, 0.01, 6, 48)), N);
      const r2 = mesh(cached('cy-q-r2', () => new THREE.TorusGeometry(0.23, 0.008, 6, 48)), N);
      r1.position.y = r2.position.y = 1.22;
      root.add(r1, r2);
      const prev = root.userData.animate;
      root.userData.animate = (t) => {
        prev(t);
        r1.rotation.set(t * 1.1, t * 0.7, 0);
        r2.rotation.set(-t * 0.8, 0, t * 1.2);
      };
      break;
    }
    case 'k': {
      hexBase(color, root, 0.38);
      const kG = cached('cy-k', () => latheSharp([[0.24, 0.11], [0.15, 0.95], [0.21, 1.05], [0.21, 1.12], [0, 1.12]], 8));
      root.add(mesh(kG, C), edges(kG, color));
      const cross = new THREE.Group();
      const v = mesh(cached('cy-k-v', () => new THREE.BoxGeometry(0.06, 0.32, 0.06)), N);
      const h = mesh(cached('cy-k-h', () => new THREE.BoxGeometry(0.22, 0.06, 0.06)), N);
      h.position.y = 0.04;
      cross.add(v, h);
      floater(root, cross, 1.38, 0.03, 1.4, 0.9);
      const halo = mesh(cached('cy-k-halo', () => new THREE.RingGeometry(0.2, 0.235, 6)), H);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 1.16;
      root.add(halo);
      const prev = root.userData.animate;
      root.userData.animate = (t) => { prev(t); halo.rotation.z = -t * 0.6; };
      break;
    }
    default: break;
  }
  return root;
}
