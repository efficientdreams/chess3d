// Modern minimalist set: Bauhaus-inspired forms in glazed ceramic and brushed metal.
import * as THREE from 'three';
import { cached, latheSharp, lathe, angularHorseShape, extrudeShape, mesh, faceRotation } from './common.js';

const mats = {};
function body(color) {
  if (!mats['b' + color]) {
    mats['b' + color] = color === 'w'
      ? new THREE.MeshPhysicalMaterial({ color: '#f4f4f1', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 })
      : new THREE.MeshPhysicalMaterial({ color: '#1b1c20', roughness: 0.45, metalness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  }
  return mats['b' + color];
}
function accent(color) {
  if (!mats['a' + color]) {
    mats['a' + color] = color === 'w'
      ? new THREE.MeshStandardMaterial({ color: '#e0b46a', metalness: 0.6, roughness: 0.3, emissive: '#3a2a10', emissiveIntensity: 0.4 })
      : new THREE.MeshStandardMaterial({ color: '#d4794a', metalness: 0.6, roughness: 0.32, emissive: '#3a1a0a', emissiveIntensity: 0.4 });
  }
  return mats['a' + color];
}

function base(color, root, r = 0.33) {
  root.add(mesh(cached('mod-base' + r, () => latheSharp([[r, 0], [r, 0.06], [r - 0.02, 0.08], [0, 0.08]], 48)), body(color)));
  const band = mesh(cached('mod-band' + r, () => new THREE.CylinderGeometry(r - 0.01, r - 0.01, 0.02, 48)), accent(color));
  band.position.y = 0.09;
  root.add(band);
}

export function buildModern(type, color) {
  const root = new THREE.Group();
  const B = body(color), A = accent(color);
  switch (type) {
    case 'p': {
      base(color, root, 0.28);
      const c = mesh(cached('mod-p-col', () => latheSharp([[0.12, 0.1], [0.1, 0.48], [0, 0.48]], 40)), B);
      const s = mesh(cached('mod-p-ball', () => new THREE.SphereGeometry(0.15, 32, 20)), B);
      s.position.y = 0.6;
      root.add(c, s);
      break;
    }
    case 'r': {
      base(color, root);
      const tower = mesh(cached('mod-r', () => {
        const g = new THREE.BoxGeometry(0.42, 0.78, 0.42);
        g.translate(0, 0.49, 0);
        return g;
      }), B);
      const notch = mesh(cached('mod-r-notch', () => new THREE.BoxGeometry(0.44, 0.1, 0.12)), A);
      notch.position.y = 0.85;
      const notch2 = notch.clone();
      notch2.rotation.y = Math.PI / 2;
      root.add(tower, notch, notch2);
      break;
    }
    case 'n': {
      base(color, root);
      const pivot = new THREE.Group();
      pivot.rotation.y = faceRotation(color);
      const h = mesh(cached('mod-horse', () => {
        const g = extrudeShape(angularHorseShape(), 0.22, 0.01, 1);
        g.scale(0.95, 1.05, 1);
        g.translate(0, 0.1, 0);
        return g;
      }), B);
      const stripe = mesh(cached('mod-n-stripe', () => new THREE.BoxGeometry(0.06, 0.4, 0.25)), A);
      stripe.position.set(-0.24, 0.62, 0);
      stripe.rotation.z = -0.35;
      pivot.add(h, stripe);
      root.add(pivot);
      break;
    }
    case 'b': {
      base(color, root);
      root.add(mesh(cached('mod-b', () => lathe([[0.2, 0.1], [0.18, 0.4], [0.15, 0.8], [0.09, 1.08], [0.0, 1.22]], { samples: 60 })), B));
      const ring = mesh(cached('mod-b-ring', () => new THREE.TorusGeometry(0.155, 0.018, 12, 40)), A);
      ring.position.y = 0.82;
      ring.rotation.x = Math.PI / 2 + 0.45;
      root.add(ring);
      break;
    }
    case 'q': {
      base(color, root, 0.35);
      root.add(mesh(cached('mod-q', () => latheSharp([[0.2, 0.1], [0.14, 1.05], [0.21, 1.2], [0.0, 1.2]], 48)), B));
      const g = cached('mod-q-ball', () => new THREE.SphereGeometry(0.04, 16, 10));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const s = mesh(g, A);
        s.position.set(Math.cos(a) * 0.18, 1.24, Math.sin(a) * 0.18);
        root.add(s);
      }
      const top = mesh(cached('mod-q-top', () => new THREE.SphereGeometry(0.075, 24, 16)), A);
      top.position.y = 1.32;
      root.add(top);
      break;
    }
    case 'k': {
      base(color, root, 0.35);
      root.add(mesh(cached('mod-k', () => latheSharp([[0.22, 0.1], [0.15, 1.15], [0.2, 1.22], [0.0, 1.22]], 48)), B));
      const v = mesh(cached('mod-k-v', () => new THREE.BoxGeometry(0.07, 0.34, 0.07)), A);
      v.position.y = 1.38;
      const h = mesh(cached('mod-k-h', () => new THREE.BoxGeometry(0.24, 0.07, 0.07)), A);
      h.position.y = 1.42;
      root.add(v, h);
      break;
    }
    default: break;
  }
  return root;
}
