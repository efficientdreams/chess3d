// Classic Staunton pieces in boxwood and ebony.
import * as THREE from 'three';
import { cached, lathe, latheSharp, horseShape, extrudeShape, taperHorse, mesh, faceRotation } from './common.js';

const mats = {};
function material(color) {
  if (!mats[color]) {
    mats[color] = color === 'w'
      ? new THREE.MeshPhysicalMaterial({ color: '#efe0c2', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.2 })
      : new THREE.MeshPhysicalMaterial({ color: '#2a1b12', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  }
  return mats[color];
}
const felt = new THREE.MeshStandardMaterial({ color: '#1f4a22', roughness: 1 });

const BASE = [[0.37, 0], [0.37, 0.05], [0.35, 0.07], [0.33, 0.09], [0.34, 0.12], [0.29, 0.15], [0.24, 0.18]];

const PROFILES = {
  p: [...BASE, [0.17, 0.25], [0.13, 0.4], [0.11, 0.52], [0.2, 0.56], [0.2, 0.58], [0.1, 0.61], [0.15, 0.68], [0.17, 0.77], [0.14, 0.86], [0.07, 0.91], [0.0, 0.92]],
  r: [[0.38, 0], [0.38, 0.06], [0.35, 0.09], [0.36, 0.13], [0.3, 0.17], [0.25, 0.25], [0.22, 0.5], [0.22, 0.75], [0.29, 0.8], [0.29, 0.83], [0.25, 0.86], [0.27, 1.02], [0.27, 1.1], [0.2, 1.1], [0.2, 1.02], [0.0, 1.02]],
  b: [...BASE, [0.17, 0.3], [0.12, 0.62], [0.11, 0.78], [0.22, 0.82], [0.22, 0.85], [0.12, 0.88], [0.16, 0.95], [0.19, 1.05], [0.17, 1.17], [0.12, 1.26], [0.06, 1.31], [0.07, 1.34], [0.05, 1.37], [0.0, 1.38]],
  q: [...BASE, [0.19, 0.3], [0.13, 0.7], [0.11, 0.98], [0.24, 1.03], [0.24, 1.06], [0.13, 1.1], [0.17, 1.2], [0.23, 1.38], [0.21, 1.42], [0.15, 1.44], [0.1, 1.48], [0.07, 1.52], [0.0, 1.53]],
  k: [...BASE, [0.2, 0.3], [0.14, 0.75], [0.12, 1.05], [0.25, 1.1], [0.25, 1.13], [0.14, 1.17], [0.18, 1.27], [0.23, 1.44], [0.2, 1.49], [0.12, 1.52], [0.0, 1.53]],
  n: [...BASE, [0.22, 0.25], [0.25, 0.28], [0.25, 0.31], [0.0, 0.31]],
};

function crenellations() {
  return cached('classic-cren', () => {
    const group = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const a = (i / 6) * Math.PI * 2;
      g.translate(Math.cos(a) * 0.235, 1.15, Math.sin(a) * 0.235);
      g.rotateY(0);
      group.push(g);
    }
    return group;
  });
}

export function buildClassic(type, color) {
  const mat = material(color);
  const root = new THREE.Group();
  const isSharp = type === 'r';
  const body = cached('classic-' + type, () => (isSharp ? latheSharp(PROFILES[type]) : lathe(PROFILES[type])));
  root.add(mesh(body, mat));

  if (type === 'r') {
    for (const g of crenellations()) root.add(mesh(g, mat));
  }
  if (type === 'n') {
    const head = cached('classic-horse', () => {
      const g = taperHorse(extrudeShape(horseShape(), 0.2, 0.05));
      g.scale(0.95, 0.95, 1);
      g.translate(0, 0.3, 0);
      return g;
    });
    const h = mesh(head, mat);
    h.rotation.y = faceRotation(color);
    root.add(h);
    // Eyes and mane groove accents
    const eyeMat = color === 'w' ? material('b') : material('w');
    const eyeGeo = cached('classic-eye', () => new THREE.SphereGeometry(0.025, 10, 8));
    for (const side of [-1, 1]) {
      const e = mesh(eyeGeo, eyeMat);
      // local horse coords: x forward, z side -> rotate later via pivot
      const pivot = new THREE.Group();
      e.position.set(0.15, 0.98, side * 0.115);
      pivot.add(e);
      pivot.rotation.y = faceRotation(color);
      root.add(pivot);
    }
  }
  if (type === 'b') {
    // Mitre slit
    const slit = cached('classic-slit', () => new THREE.BoxGeometry(0.02, 0.14, 0.4));
    const s = mesh(slit, color === 'w' ? material('b') : new THREE.MeshStandardMaterial({ color: '#8d6a44' }));
    s.position.set(0.0, 1.15, 0);
    s.rotation.z = 0.6;
    s.rotation.y = color === 'w' ? 0 : Math.PI;
    root.add(s);
  }
  if (type === 'q') {
    const ballGeo = cached('classic-qball', () => new THREE.SphereGeometry(0.04, 12, 8));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = mesh(ballGeo, mat);
      b.position.set(Math.cos(a) * 0.205, 1.43, Math.sin(a) * 0.205);
      root.add(b);
    }
    const top = mesh(ballGeo, mat);
    top.scale.setScalar(1.6);
    top.position.y = 1.57;
    root.add(top);
  }
  if (type === 'k') {
    const v = cached('classic-cross-v', () => new THREE.BoxGeometry(0.07, 0.3, 0.07));
    const hgeo = cached('classic-cross-h', () => new THREE.BoxGeometry(0.22, 0.07, 0.07));
    const cv = mesh(v, mat); cv.position.y = 1.66;
    const ch = mesh(hgeo, mat); ch.position.y = 1.7;
    root.add(cv, ch);
  }
  const f = mesh(cached('classic-felt', () => {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.01, 32);
    g.translate(0, 0.004, 0);
    return g;
  }), felt);
  root.add(f);
  return root;
}
