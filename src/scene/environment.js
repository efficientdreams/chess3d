// Sherwood forest clearing: ancient oaks, a great tree stump, a waterfall and a river.
// World units are metres. The stump top sits at STUMP_TOP and the board rests on it.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { mulberry32, noise2, fbm2, fbm3 } from './noise.js';
import {
  barkTexture, birchTexture, stumpTopTexture, rockTexture, groundTexture, leafTexture,
  fernTexture, softSprite, cloudSprite, woodTexture,
} from './textures.js';
import { createWaterMaterial, createWaterfallMaterial, createShaftMaterial } from './water.js';

export const STUMP_TOP = 0.74;
export const STUMP_RADIUS = 0.56;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- layout
const WATERFALL = { x: -8, lipY: 13.2, lipZ: -36.4, baseZ: -32.6, width: 5.2 };
const POOL = { x: -8, z: -29.5, r: 5.2 };
const RIVER_PTS = [
  [-8, -29.5], [-5, -22], [1.5, -14.5], [5.8, -6], [6.4, 3], [4.6, 12], [6.2, 23], [12.5, 38], [20, 66], [28, 110], [34, 170],
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const UPPER_PTS = [[-8, -35.6], [-8.6, -46], [-12, -70], [-18, -110], [-22, -170]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const RIVER_WIDTH = 4.4;
const WATER_TOP = 0.05; // river surface height at the pool, descends downstream
const PLATEAU = 13.4;

const riverCurve = new THREE.CatmullRomCurve3(RIVER_PTS, false, 'catmullrom', 0.5);
const upperCurve = new THREE.CatmullRomCurve3(UPPER_PTS, false, 'catmullrom', 0.5);
const riverSamples = riverCurve.getSpacedPoints(400);
const upperSamples = upperCurve.getSpacedPoints(200);

// Nearest point on a sampled curve: coarse scan then local refinement.
function nearest(samples, x, z) {
  let best = Infinity, bi = 0;
  const step = 8;
  for (let i = 0; i < samples.length; i += step) {
    const p = samples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  const lo = Math.max(0, bi - step * 2), hi = Math.min(samples.length - 1, bi + step * 2);
  for (let i = lo; i <= hi; i++) {
    const p = samples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return { d: Math.sqrt(best), t: bi / (samples.length - 1) };
}
const riverSurface = (t) => WATER_TOP - t * 1.6;

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = fbm2(x * 0.035, z * 0.035, 4) * 1.6 * smoothstep(3, 20, r);
  h += fbm2(x * 0.4, z * 0.4, 2) * 0.05 * smoothstep(0.7, 2, r);
  h += smoothstep(55, 150, r) * (fbm2(x * 0.012, z * 0.012, 3) * 0.6 + 0.7) * 22;
  // Cliff behind the waterfall
  const cliffZ = -34.2 + noise2(x * 0.09, 3.3) * 1.6;
  const cl = smoothstep(cliffZ, cliffZ - 3.2, z);
  const plateau = PLATEAU + fbm2(x * 0.05, z * 0.05, 3) * 1.6 + smoothstep(-60, -150, z) * 6;
  h = lerp(h, Math.max(h, plateau), cl);
  // Upper river channel on the plateau
  if (z < -33) {
    const u = nearest(upperSamples, x, z);
    const carve = 1 - smoothstep(1.6, 4.5, u.d);
    h = lerp(h, PLATEAU - 1.0, carve * cl);
  }
  // Lower river & pool
  if (z > -40) {
    const rv = nearest(riverSamples, x, z);
    const bed = riverSurface(rv.t) - 0.75;
    h = lerp(h, bed, 1 - smoothstep(RIVER_WIDTH * 0.5, RIVER_WIDTH * 0.5 + 3.2, rv.d));
    const dp = Math.hypot(x - POOL.x, z - POOL.z);
    h = lerp(h, WATER_TOP - 1.1, 1 - smoothstep(POOL.r - 1, POOL.r + 2.5, dp));
  }
  return h;
}

export function riverDistance(x, z) {
  const a = nearest(riverSamples, x, z).d;
  const b = Math.hypot(x - POOL.x, z - POOL.z) - POOL.r;
  return Math.min(a, b);
}

// --------------------------------------------------------------- builders
function windify(material, { strength = 0.08, heightRef = 1, uniforms }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        {
          vec4 wpos = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpos = instanceMatrix * wpos;
          #endif
          wpos = modelMatrix * wpos;
          float k = clamp(position.y / ${heightRef.toFixed(3)}, 0.0, 1.5);
          k = k * k;
          float s = sin(uTime * 1.7 + wpos.x * 0.6 + wpos.z * 0.4) + 0.4 * sin(uTime * 3.1 + wpos.x * 1.9);
          transformed.x += s * ${strength.toFixed(4)} * k * uWind;
          transformed.z += cos(uTime * 1.3 + wpos.z * 0.7) * ${(strength * 0.6).toFixed(4)} * k * uWind;
        }
      `);
  };
}

function displace(geo, amount, freq, seed = 0) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm3(v.x * freq + seed, v.y * freq, v.z * freq, 3);
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amount) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function colorize(geo, fn) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, c, i);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function cylinderBetween(a, b, r0, r1, radial = 8, seg = 4) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, seg, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// An ancient oak: gnarled trunk, heavy limbs and clumped canopy with leaf cards.
function buildOak(seed) {
  const rng = mulberry32(seed);
  const H = 7 + rng() * 3; // trunk height to crown
  const R = 0.55 + rng() * 0.35;
  const barkParts = [];
  const leafBlobs = [];
  const leafCards = [];

  const trunk = new THREE.CylinderGeometry(R * 0.55, R, H, 14, 10, true);
  trunk.translate(0, H / 2, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const flare = 1 + Math.max(0, 1 - y / 1.4) ** 2 * (0.6 + 0.35 * Math.sin(a * 5 + seed));
    const gnarl = 1 + fbm3(Math.cos(a) * 1.5, y * 0.35, Math.sin(a) * 1.5 + seed, 3) * 0.35;
    const bend = Math.sin(y * 0.35 + seed) * 0.25 * (y / H);
    p.setXYZ(i, x * flare * gnarl + bend, y, z * flare * gnarl);
  }
  trunk.computeVertexNormals();
  barkParts.push(trunk);

  const limbs = 4 + Math.floor(rng() * 3);
  const crownPts = [new THREE.Vector3(0, H + 2.5, 0)];
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rng() * 0.8;
    const y0 = H * (0.6 + rng() * 0.35);
    const len = 4 + rng() * 3.5;
    const start = new THREE.Vector3(0, y0, 0);
    const mid = new THREE.Vector3(Math.cos(a) * len * 0.55, y0 + len * 0.35, Math.sin(a) * len * 0.55);
    const end = new THREE.Vector3(Math.cos(a) * len, y0 + len * (0.45 + rng() * 0.3), Math.sin(a) * len);
    barkParts.push(cylinderBetween(start, mid, R * 0.45, R * 0.3, 7, 3));
    barkParts.push(cylinderBetween(mid, end, R * 0.3, R * 0.12, 6, 3));
    crownPts.push(end, mid.clone().add(new THREE.Vector3(0, 1.4, 0)));
  }
  for (const c of crownPts) {
    const n = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      const rad = 2.0 + rng() * 1.8;
      const g = smoothIco(rad, 1);
      displace(g, rad * 0.45, 0.5, seed + k * 7);
      g.scale(1, 0.7, 1);
      const off = new THREE.Vector3((rng() - 0.5) * 2.5, (rng() - 0.2) * 1.5, (rng() - 0.5) * 2.5);
      g.translate(c.x + off.x, c.y + off.y, c.z + off.z);
      leafBlobs.push(g);
      // Leaf cards scattered over the blob surface for a fluffy silhouette
      for (let j = 0; j < 22; j++) {
        const card = new THREE.PlaneGeometry(2.0, 2.0);
        const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.25, rng() - 0.5).normalize();
        card.lookAt(dir);
        card.rotateZ(rng() * Math.PI);
        const pos = dir.multiplyScalar(rad * 0.95);
        pos.y *= 0.7;
        card.translate(c.x + off.x + pos.x, c.y + off.y + pos.y, c.z + off.z + pos.z);
        leafCards.push(card);
      }
    }
  }
  const bark = mergeGeometries(barkParts.map((g) => g.toNonIndexed ? g.toNonIndexed() : g));
  const blobs = mergeGeometries(leafBlobs);
  colorize(blobs, (v, c) => {
    const shade = 0.55 + 0.45 * smoothstep(H - 1, H + 7, v.y) + fbm3(v.x * 0.4, v.y * 0.4, v.z * 0.4, 2) * 0.25;
    c.setRGB(0.17 * shade, 0.31 * shade, 0.09 * shade);
  });
  const cards = mergeGeometries(leafCards);
  return { bark, blobs, cards, height: H + 6 };
}

function buildBirch(seed) {
  const rng = mulberry32(seed);
  const H = 12 + rng() * 5;
  const trunk = new THREE.CylinderGeometry(0.09, 0.22, H, 8, 8, true);
  trunk.translate(0, H / 2, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(y * 0.3 + seed) * 0.25 * (y / H));
  }
  trunk.computeVertexNormals();
  const blobs = [];
  const cards = [];
  for (let k = 0; k < 6; k++) {
    const rad = 1.2 + rng() * 1.0;
    const y = H * (0.55 + (k / 6) * 0.45);
    const g = smoothIco(rad, 1);
    displace(g, rad * 0.4, 0.7, seed + k);
    g.scale(1, 1.2, 1);
    const ox = (rng() - 0.5) * 1.6, oz = (rng() - 0.5) * 1.6;
    g.translate(ox + Math.sin(y * 0.3 + seed) * 0.25, y, oz);
    blobs.push(g);
    for (let j = 0; j < 10; j++) {
      const card = new THREE.PlaneGeometry(1.2, 1.2);
      const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      card.lookAt(dir);
      const pos = dir.multiplyScalar(rad);
      card.translate(ox + pos.x, y + pos.y * 1.2, oz + pos.z);
      cards.push(card);
    }
  }
  const b = mergeGeometries(blobs);
  colorize(b, (v, c) => {
    const s = 0.6 + 0.4 * smoothstep(H * 0.5, H * 1.1, v.y);
    c.setRGB(0.33 * s, 0.45 * s, 0.16 * s);
  });
  return { bark: trunk, blobs: b, cards: mergeGeometries(cards), height: H };
}

// Indexed icosphere so displaced shapes get smooth normals.
function smoothIco(r, detail) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv'));
  return g;
}

function rockGeometry(seed, detail = 2) {
  const g = smoothIco(1, detail);
  displace(g, 0.35, 1.3, seed);
  g.scale(1, 0.65, 1);
  g.computeVertexNormals();
  // Moss on the upward-facing surfaces
  const n = g.attributes.normal;
  colorize(g, (v, c, i) => {
    const up = smoothstep(0.35, 0.85, n.getY(i)) * (0.6 + 0.4 * fbm3(v.x * 2 + seed, v.y * 2, v.z * 2, 2));
    c.setRGB(1, 1, 1).lerp(new THREE.Color(0.45, 0.62, 0.25), Math.max(0, up));
  });
  return g;
}

// Ribbon geometry along a curve, uv.x across (0..1) and uv.y = metres along.
function ribbon(samples, width, heightFn) {
  const verts = [], uvs = [], idx = [];
  let dist = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const q = samples[Math.min(i + 1, samples.length - 1)];
    const o = samples[Math.max(i - 1, 0)];
    const t = new THREE.Vector3().subVectors(q, o).setY(0).normalize();
    const n = new THREE.Vector3(-t.z, 0, t.x);
    if (i > 0) dist += p.distanceTo(samples[i - 1]);
    const y = heightFn(i / (samples.length - 1));
    const w = typeof width === 'function' ? width(i / (samples.length - 1)) : width;
    verts.push(p.x + n.x * w / 2, y, p.z + n.z * w / 2, p.x - n.x * w / 2, y, p.z - n.z * w / 2);
    uvs.push(0, dist, 1, dist);
    if (i < samples.length - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------ environment
export class Environment {
  constructor(scene, renderer, { quality = 'high' } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.updaters = [];
    this.windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
    this.group = new THREE.Group();
    scene.add(this.group);

    this.sunDir = new THREE.Vector3(-0.55, 0.78, 0.32).normalize();
    this._sky();
    this._lights();
    this._terrain();
    this._water();
    this._stump();
    this._trees();
    this._rocks();
    this._undergrowth();
    this._props();
    this._particles();
    this._environmentMap();
  }

  update(dt, t) {
    this.windUniforms.uTime.value = t;
    for (const fn of this.updaters) fn(dt, t);
  }

  _sky() {
    const fogColor = new THREE.Color('#b4bf95');
    this.scene.fog = new THREE.FogExp2(fogColor, 0.011);
    this.scene.background = fogColor;
    const geo = new THREE.SphereGeometry(480, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color('#5d8fc9') },
        uHorizon: { value: new THREE.Color('#d8dcb4') },
        uBottom: { value: new THREE.Color('#6d7b55') },
        uSunDir: { value: this.sunDir },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uBottom, uSunDir; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.7, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
          float sun = max(dot(normalize(vDir), uSunDir), 0.0);
          c += vec3(1.0, 0.9, 0.65) * (pow(sun, 600.0) * 4.0 + pow(sun, 12.0) * 0.35);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    // Drifting clouds high above the canopy
    const cloudMat = new THREE.SpriteMaterial({ map: cloudSprite(), color: '#ffffff', transparent: true, opacity: 0.75, fog: false, depthWrite: false });
    const rng = mulberry32(99);
    const clouds = [];
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(cloudMat);
      const a = rng() * Math.PI * 2, d = 120 + rng() * 200;
      s.position.set(Math.cos(a) * d, 70 + rng() * 60, Math.sin(a) * d);
      s.scale.set(80 + rng() * 80, 30 + rng() * 20, 1);
      this.group.add(s);
      clouds.push(s);
    }
    this.updaters.push((dt) => { for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 300) c.position.x = -300; } });
  }

  _lights() {
    const hemi = new THREE.HemisphereLight('#e2ecff', '#4a5528', 1.0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffe2b0', 3.6);
    sun.position.copy(this.sunDir).multiplyScalar(6).add(new THREE.Vector3(0, STUMP_TOP, 0));
    sun.target.position.set(0, STUMP_TOP, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -1.3; sc.right = 1.3; sc.top = 1.3; sc.bottom = -1.3; sc.near = 0.5; sc.far = 14;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.hemi = hemi;

    // Wide, soft fill for the forest itself
    const fill = new THREE.DirectionalLight('#b8d0ff', 0.5);
    fill.position.set(4, 6, -6);
    this.scene.add(fill);
  }

  _terrain() {
    const size = 360, seg = this.quality === 'low' ? 160 : 240;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    // Concentrate vertices near the clearing for detail: warp positions radially.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z) || 1;
      const nr = (r / (size / 2)) ** 1.6 * (size / 2);
      const k = Math.max(nr / r, 0);
      x *= k; z *= k;
      pos.setXYZ(i, x, terrainHeight(x, z), z);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    colorize(geo, (v, c, i) => {
      const slope = nrm.getY(i);
      const d = riverDistance(v.x, v.z);
      const n = fbm2(v.x * 0.15, v.z * 0.15, 3);
      c.setRGB(0.85 + n * 0.25, 0.9 + n * 0.2, 0.75 + n * 0.2);
      // muddy, pebbly banks
      const bank = 1 - smoothstep(RIVER_WIDTH * 0.5 - 0.4, RIVER_WIDTH * 0.5 + 1.6, d);
      c.lerp(new THREE.Color(0.55, 0.47, 0.36), bank * 0.85);
      // rocky cliffs
      const rock = 1 - smoothstep(0.55, 0.8, slope);
      c.lerp(new THREE.Color(0.55, 0.55, 0.52), rock);
      // darker under the canopy far away, worn earth around the stump
      const r = Math.hypot(v.x, v.z);
      c.lerp(new THREE.Color(0.62, 0.52, 0.36), (1 - smoothstep(0.6, 1.6, r)) * 0.8);
    });
    const mat = new THREE.MeshStandardMaterial({ map: groundTexture(), vertexColors: true, roughness: 1, metalness: 0 });
    mat.map.repeat.set(90, 90);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.terrain = mesh;
  }

  _water() {
    const riverMat = createWaterMaterial({ flowSpeed: 0.55 });
    riverMat.uniforms.uSunDir.value = this.sunDir;
    const riverGeo = ribbon(riverSamples, (t) => RIVER_WIDTH * (t < 0.02 ? 1.6 - t * 30 : 1), (t) => riverSurface(t) - 0.25);
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.renderOrder = 1;
    this.group.add(river);

    const upperMat = createWaterMaterial({ flowSpeed: -0.9 });
    upperMat.uniforms.uSunDir.value = this.sunDir;
    const upper = new THREE.Mesh(ribbon(upperSamples, 3.4, () => PLATEAU - 0.55), upperMat);
    upper.renderOrder = 1;
    this.group.add(upper);

    // Plunge pool
    const poolMat = createWaterMaterial({ flowSpeed: 0.25, deep: '#0b3236', shallow: '#3f7c70', foamEdges: false });
    poolMat.uniforms.uSunDir.value = this.sunDir;
    const poolGeo = new THREE.CircleGeometry(POOL.r + 1.2, 48);
    poolGeo.rotateX(-Math.PI / 2);
    // Radial uv so the shader treats the centre as "deep"
    const pu = poolGeo.attributes.uv;
    const pp = poolGeo.attributes.position;
    for (let i = 0; i < pu.count; i++) {
      const x = pp.getX(i), z = pp.getZ(i);
      const r = Math.hypot(x, z) / (POOL.r + 1.2);
      pu.setXY(i, 0.5 + r * 0.5, Math.atan2(z, x) * 3 + r * 4);
    }
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(POOL.x, WATER_TOP - 0.24, POOL.z);
    pool.renderOrder = 1;
    this.group.add(pool);

    // Waterfall: curved sheet from the lip down into the pool
    const wf = WATERFALL;
    const rows = 40, cols = 12;
    const verts = [], uvs = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows; // 0 top -> 1 bottom
      const y = lerp(wf.lipY, WATER_TOP - 0.2, v);
      const z = wf.lipZ + Math.sin(Math.min(v * 2.2, 1) * Math.PI / 2) * 1.0 + v * (wf.baseZ - wf.lipZ - 1.0);
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const spread = 1 + v * 0.35;
        const x = wf.x + (u - 0.5) * wf.width * spread + Math.sin(u * 9 + v * 3) * 0.08;
        verts.push(x, y, z + Math.sin(u * 7.0) * 0.15);
        uvs.push(u, 1 - v);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i, b = a + cols + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const wfGeo = new THREE.BufferGeometry();
    wfGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    wfGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wfGeo.setIndex(idx);
    wfGeo.computeVertexNormals();
    const wfMat = createWaterfallMaterial();
    const fall = new THREE.Mesh(wfGeo, wfMat);
    fall.renderOrder = 2;
    this.group.add(fall);
    const fall2 = new THREE.Mesh(wfGeo, createWaterfallMaterial());
    fall2.material.uniforms.uSpeed.value = 1.35;
    fall2.position.z += 0.25;
    fall2.scale.x = 0.92;
    fall2.position.x = wf.x * (1 - 0.92);
    fall2.renderOrder = 3;
    this.group.add(fall2);

    this.updaters.push((dt, t) => {
      riverMat.uniforms.uTime.value = t;
      upperMat.uniforms.uTime.value = t;
      poolMat.uniforms.uTime.value = t;
      wfMat.uniforms.uTime.value = t;
      fall2.material.uniforms.uTime.value = t + 3.7;
    });
    this.waterMats = [riverMat, upperMat, poolMat];
  }

  _stump() {
    const g = new THREE.Group();
    const R = STUMP_RADIUS, H = STUMP_TOP;
    // Bark sides with a flared base and root buttresses
    const side = new THREE.CylinderGeometry(R, R * 1.25, H + 0.15, 48, 12, true);
    side.translate(0, (H + 0.15) / 2 - 0.15, 0);
    const p = side.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const base = Math.max(0, 1 - (y + 0.15) / 0.45);
      const roots = 1 + base * base * (0.35 + 0.3 * Math.max(0, Math.sin(a * 6 + 1.3)));
      const bump = 1 + fbm3(Math.cos(a) * 3, y * 4, Math.sin(a) * 3, 3) * 0.07;
      p.setXYZ(i, x * roots * bump, y, z * roots * bump);
    }
    side.computeVertexNormals();
    const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture().clone(), roughness: 0.95, color: '#9a8a76' });
    barkMat.map.repeat.set(4, 0.5);
    barkMat.map.needsUpdate = true;
    const sideMesh = new THREE.Mesh(side, barkMat);
    sideMesh.castShadow = true; sideMesh.receiveShadow = true;
    g.add(sideMesh);

    // Ring-patterned top
    const top = new THREE.CircleGeometry(R * 1.01, 64);
    top.rotateX(-Math.PI / 2);
    const tp = top.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i);
      const r = Math.hypot(x, z) / R;
      tp.setY(i, -Math.max(0, r - 0.9) * 0.15 + fbm2(x * 9, z * 9, 2) * 0.004);
    }
    top.computeVertexNormals();
    const topMesh = new THREE.Mesh(top, new THREE.MeshStandardMaterial({ map: stumpTopTexture(), roughness: 0.85 }));
    topMesh.position.y = H;
    topMesh.receiveShadow = true;
    g.add(topMesh);

    // Roots snaking into the ground
    const rootMat = barkMat;
    const rng = mulberry32(21);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const d = R * 1.05 + k * (0.18 + rng() * 0.05);
        const y = 0.18 - k * 0.055 + rng() * 0.02;
        const wob = Math.sin(k * 1.3 + i) * 0.1;
        pts.push(new THREE.Vector3(Math.cos(a + wob) * d, Math.max(y, -0.08), Math.sin(a + wob) * d));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 16, 0.06, 7, false);
      const tpos = tube.attributes.position;
      for (let k = 0; k < tpos.count; k++) {
        // taper toward the tip
        const v = new THREE.Vector3().fromBufferAttribute(tpos, k);
        const d = Math.hypot(v.x, v.z);
        const tt = smoothstep(R, R * 1.05 + 1.1, d);
        const c = curve.getPointAt(Math.min(1, tt));
        v.sub(c).multiplyScalar(1.3 - tt * 0.9).add(c);
        tpos.setXYZ(k, v.x, v.y, v.z);
      }
      tube.computeVertexNormals();
      const m = new THREE.Mesh(tube, rootMat);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }

    // Moss patches & fly agaric mushrooms at the base
    const capMat = new THREE.MeshStandardMaterial({ color: '#b5281c', roughness: 0.5 });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8 });
    const dotMat = new THREE.MeshStandardMaterial({ color: '#f8f3e8', roughness: 0.6 });
    const capGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const stemGeo = new THREE.CylinderGeometry(0.6, 0.75, 1, 10);
    const dotGeo = new THREE.SphereGeometry(0.12, 6, 4);
    const spots = [[0.55, 0.12, 0.6], [0.66, -0.02, 0.4], [-0.62, 0.4, 0.55], [0.05, -0.75, 0.5], [0.1, -0.85, 0.35], [-0.5, -0.55, 0.45]];
    for (const [sx, sz, s] of spots) {
      const m = new THREE.Group();
      const sc = 0.05 * s / 0.5;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.scale.set(sc * 0.35, sc * 1.6, sc * 0.35);
      stem.position.y = sc * 0.8;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.scale.set(sc, sc * 0.7, sc);
      cap.position.y = sc * 1.5;
      m.add(stem, cap);
      for (let k = 0; k < 7; k++) {
        const d = new THREE.Mesh(dotGeo, dotMat);
        const a = rng() * Math.PI * 2, el = 0.3 + rng() * 1.0;
        d.position.set(Math.cos(a) * Math.cos(el) * sc, sc * 1.5 + Math.sin(el) * sc * 0.7, Math.sin(a) * Math.cos(el) * sc);
        d.scale.setScalar(sc * 1.2);
        m.add(d);
      }
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const r = R * 1.3 + Math.hypot(sx, sz) * 0.2;
      const a = Math.atan2(sz, sx);
      m.position.set(Math.cos(a) * r, terrainHeight(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r);
      m.rotation.z = (rng() - 0.5) * 0.3;
      g.add(m);
    }

    this.group.add(g);
    this.stump = g;
  }

  _trees() {
    const rng = mulberry32(1234);
    const oakVariants = [buildOak(3), buildOak(17), buildOak(41), buildOak(77)];
    const birchVariants = [buildBirch(5), buildBirch(9)];
    const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1, color: '#c8b8a0' });
    const birchMat = new THREE.MeshStandardMaterial({ map: birchTexture(), roughness: 0.9 });
    const blobMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: '#ffffff' });
    const cardMat = new THREE.MeshStandardMaterial({
      map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: '#e8ffc0',
    });
    windify(blobMat, { strength: 0.12, heightRef: 14, uniforms: this.windUniforms });
    windify(cardMat, { strength: 0.18, heightRef: 14, uniforms: this.windUniforms });

    const placements = { oak: oakVariants.map(() => []), birch: birchVariants.map(() => []) };
    const taken = [];
    const tryPlace = (x, z, minGap) => {
      if (Math.hypot(x, z) < 6.5) return false;
      if (riverDistance(x, z) < 3.8) return false;
      if (Math.abs(x - WATERFALL.x) < 6 && z < -30 && z > -40) return false;
      if (z < -33.5 && z > -37.5) return false; // the cliff face itself
      const u = nearest(upperSamples, x, z);
      if (z < -34 && u.d < 3.5) return false;
      for (const [tx, tz] of taken) if ((tx - x) ** 2 + (tz - z) ** 2 < minGap * minGap) return false;
      taken.push([x, z]);
      return true;
    };
    // A ring of great oaks framing the clearing
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.3;
      const d = 9 + rng() * 6;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (tryPlace(x, z, 6)) placements.oak[i % oakVariants.length].push([x, z, 1.1 + rng() * 0.35, rng() * Math.PI * 2]);
    }
    let attempts = 0;
    const target = this.quality === 'low' ? 140 : 260;
    let placed = 0;
    while (placed < target && attempts < 6000) {
      attempts++;
      const a = rng() * Math.PI * 2;
      const d = 12 + Math.pow(rng(), 0.8) * 120;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!tryPlace(x, z, 5.5)) continue;
      placed++;
      if (rng() < 0.22) placements.birch[Math.floor(rng() * birchVariants.length)].push([x, z, 0.8 + rng() * 0.5, rng() * Math.PI * 2]);
      else placements.oak[Math.floor(rng() * oakVariants.length)].push([x, z, 0.8 + rng() * 0.6, rng() * Math.PI * 2]);
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const make = (geo, mat, list, shadow) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, s, r], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
        m4.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.3, z), q, new THREE.Vector3(s, s, s));
        im.setMatrixAt(i, m4);
      });
      im.castShadow = shadow;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    };
    oakVariants.forEach((v, i) => {
      make(v.bark, barkMat, placements.oak[i], false);
      make(v.blobs, blobMat, placements.oak[i], false);
      make(v.cards, cardMat, placements.oak[i], false);
    });
    birchVariants.forEach((v, i) => {
      make(v.bark, birchMat, placements.birch[i], false);
      make(v.blobs, blobMat, placements.birch[i], false);
      make(v.cards, cardMat, placements.birch[i], false);
    });
    this.treeSpots = taken;
  }

  _rocks() {
    const rng = mulberry32(55);
    const variants = [rockGeometry(1), rockGeometry(2), rockGeometry(3)];
    const mat = new THREE.MeshStandardMaterial({ map: rockTexture(), roughness: 0.95, color: '#e8e2d4', vertexColors: true });
    const lists = variants.map(() => []);
    const add = (x, y, z, sx, sy, sz, ry) => lists[Math.floor(rng() * variants.length)].push([x, y, z, sx, sy, sz, ry]);

    // Cliff face built from big boulders, leaving a gap for the waterfall
    for (let x = -70; x <= 70; x += 3.2 + rng() * 2) {
      if (Math.abs(x - WATERFALL.x) < 3.4) continue;
      for (let layer = 0; layer < 4; layer++) {
        const y = layer * 3.6 + rng() * 1.5;
        const z = -35.3 - layer * 0.6 + (rng() - 0.5) * 1.2;
        const s = 3 + rng() * 2.5;
        add(x + (rng() - 0.5) * 2, y, z, s, s * (0.9 + rng() * 0.6), s * 0.8, rng() * 6);
      }
    }
    // Dark wet rock behind the falling water
    for (let i = 0; i < 6; i++) {
      add(WATERFALL.x + (rng() - 0.5) * 4, i * 2.4, WATERFALL.lipZ - 1.6, 2.4, 2.2, 1.5, rng() * 6);
    }
    // Lip stones at the top of the fall
    add(WATERFALL.x - 3.4, PLATEAU - 0.4, WATERFALL.lipZ + 0.2, 1.6, 1.2, 1.6, 1);
    add(WATERFALL.x + 3.4, PLATEAU - 0.4, WATERFALL.lipZ + 0.2, 1.8, 1.3, 1.6, 2);
    // Boulders around the pool and along the river banks
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      const d = POOL.r + 0.5 + rng() * 2;
      const x = POOL.x + Math.cos(a) * d, z = POOL.z + Math.sin(a) * d;
      if (z < -33) continue;
      const s = 0.5 + rng() * 1.4;
      add(x, terrainHeight(x, z) + s * 0.1, z, s, s, s, rng() * 6);
    }
    for (let i = 0; i < 140; i++) {
      const t = rng();
      const p = riverCurve.getPointAt(t);
      const tan = riverCurve.getTangentAt(t);
      const side = rng() < 0.5 ? -1 : 1;
      const off = RIVER_WIDTH * 0.5 + (rng() - 0.3) * 1.2;
      const x = p.x - tan.z * off * side, z = p.z + tan.x * off * side;
      const s = 0.15 + rng() ** 2 * 0.9;
      add(x, terrainHeight(x, z) + s * 0.05, z, s, s, s, rng() * 6);
    }
    // Stepping stones across the river near the clearing
    for (let k = 0; k < 5; k++) {
      const t = 0.16 + (rng() - 0.5) * 0.004;
      const p = riverCurve.getPointAt(t);
      const tan = riverCurve.getTangentAt(t);
      const off = (k - 2) * 0.95;
      add(p.x - tan.z * off, riverSurface(t) - 0.4, p.z + tan.x * off, 0.42, 0.5, 0.42, rng() * 6);
    }
    // Scattered forest rocks
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2, d = 3 + rng() * 80;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (riverDistance(x, z) < 3 || Math.hypot(x, z) < 2.5) continue;
      const s = 0.2 + rng() ** 2 * 1.6;
      add(x, terrainHeight(x, z), z, s, s * 0.8, s, rng() * 6);
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    variants.forEach((geo, vi) => {
      const list = lists[vi];
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z, sx, sy, sz, ry], i) => {
        q.setFromEuler(new THREE.Euler(rng() * 0.3, ry, rng() * 0.3));
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
        im.setMatrixAt(i, m4);
      });
      im.castShadow = false;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    });
  }

  _undergrowth() {
    const rng = mulberry32(808);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    // Grass blades
    const blade = new THREE.BufferGeometry();
    const bv = [-0.012, 0, 0, 0.012, 0, 0, -0.008, 0.45, 0.02, 0.008, 0.45, 0.02, 0, 1, 0.07];
    blade.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
    blade.computeVertexNormals();
    colorize(blade, (v, c) => c.setRGB(0.12 + v.y * 0.25, 0.22 + v.y * 0.35, 0.06 + v.y * 0.08));
    const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    windify(grassMat, { strength: 0.05, heightRef: 1, uniforms: this.windUniforms });
    const count = this.quality === 'low' ? 18000 : 45000;
    const grass = new THREE.InstancedMesh(blade, grassMat, count);
    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
      const a = rng() * Math.PI * 2;
      const d = 0.7 + Math.pow(rng(), 1.4) * 22;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (riverDistance(x, z) < 2.6) continue;
      if (d < STUMP_RADIUS * 1.5 && rng() < 0.7) continue;
      const h = 0.06 + rng() * (0.08 + 0.22 * smoothstep(1.2, 6, d));
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m4.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.01, z), q, new THREE.Vector3(1, h, 1));
      grass.setMatrixAt(n++, m4);
    }
    grass.count = n;
    grass.receiveShadow = true;
    grass.frustumCulled = false;
    this.group.add(grass);

    // Ferns
    const fern = new THREE.PlaneGeometry(0.35, 0.7);
    fern.translate(0, 0.35, 0);
    const fpos = fern.attributes.position;
    for (let i = 0; i < fpos.count; i++) {
      const y = fpos.getY(i);
      fpos.setZ(i, (y / 0.7) ** 2 * 0.35); // arching frond
    }
    fern.computeVertexNormals();
    const fronds = [];
    for (let k = 0; k < 7; k++) {
      const f = fern.clone();
      f.rotateX(-0.35);
      f.rotateY((k / 7) * Math.PI * 2);
      fronds.push(f);
    }
    const fernGeo = mergeGeometries(fronds);
    const fernMat = new THREE.MeshStandardMaterial({ map: fernTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
    windify(fernMat, { strength: 0.04, heightRef: 0.7, uniforms: this.windUniforms });
    const fernCount = this.quality === 'low' ? 350 : 800;
    const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
    n = 0;
    for (let i = 0; i < fernCount * 4 && n < fernCount; i++) {
      const a = rng() * Math.PI * 2;
      const d = 2.2 + Math.pow(rng(), 0.9) * 40;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (riverDistance(x, z) < 2.8 || z < -33) continue;
      const s = 0.5 + rng() * 0.8;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m4.compose(new THREE.Vector3(x, terrainHeight(x, z), z), q, new THREE.Vector3(s, s, s));
      ferns.setMatrixAt(n++, m4);
    }
    ferns.count = n;
    ferns.castShadow = false;
    ferns.receiveShadow = true;
    ferns.frustumCulled = false;
    this.group.add(ferns);

    // Bluebells (classic English woodland carpet)
    const bell = new THREE.ConeGeometry(0.012, 0.022, 6);
    bell.rotateX(Math.PI);
    const stem = new THREE.CylinderGeometry(0.002, 0.002, 0.18, 3);
    stem.translate(0, 0.09, 0);
    const bells = [];
    for (let k = 0; k < 5; k++) {
      const b = bell.clone();
      b.translate(0.02 + k * 0.004, 0.17 - k * 0.025, 0);
      b.rotateY(k * 1.3);
      bells.push(b);
    }
    const bellGeo = mergeGeometries(bells);
    const flowerMat = new THREE.MeshStandardMaterial({ color: '#5b5fd6', roughness: 0.6, emissive: '#1a1840' });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#3f6a28' });
    const fc = 1500;
    const flowers = new THREE.InstancedMesh(bellGeo, flowerMat, fc);
    const stems = new THREE.InstancedMesh(stem, stemMat, fc);
    n = 0;
    for (let i = 0; i < fc * 4 && n < fc; i++) {
      // clustered patches
      const ca = Math.floor(rng() * 9) * 0.7 + 0.5;
      const cx = Math.cos(ca) * (3 + (ca * 2.3) % 8), cz = Math.sin(ca) * (3 + (ca * 2.3) % 8);
      const x = cx + (rng() - 0.5) * 3, z = cz + (rng() - 0.5) * 3;
      if (riverDistance(x, z) < 2.8 || Math.hypot(x, z) < 1.2) continue;
      const s = 0.8 + rng() * 0.6;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m4.compose(new THREE.Vector3(x, terrainHeight(x, z), z), q, new THREE.Vector3(s, s, s));
      flowers.setMatrixAt(n, m4);
      stems.setMatrixAt(n, m4);
      n++;
    }
    flowers.count = stems.count = n;
    flowers.frustumCulled = stems.frustumCulled = false;
    this.group.add(flowers, stems);
  }

  _props() {
    // Archery butt with arrows — a nod to Sherwood's famous outlaw archers.
    const target = new THREE.Group();
    const straw = new THREE.MeshStandardMaterial({ color: '#c9a65a', roughness: 1 });
    const face = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d');
      const rings = ['#f4f0e6', '#1d1d1d', '#2f6fd1', '#d43a2f', '#f2c53d'];
      for (let i = 0; i < 5; i++) {
        x.fillStyle = rings[i]; x.beginPath(); x.arc(128, 128, 125 - i * 25, 0, Math.PI * 2); x.fill();
      }
      return c;
    })());
    face.colorSpace = THREE.SRGBColorSpace;
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 32), [straw, new THREE.MeshStandardMaterial({ map: face, roughness: 0.9 }), straw]);
    boss.rotation.x = Math.PI / 2;
    boss.position.y = 0.75;
    target.add(boss);
    const legMat = new THREE.MeshStandardMaterial({ map: woodTexture(false, 3), roughness: 0.9 });
    for (const lx of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), legMat);
      leg.position.set(lx, 0.6, 0.12);
      leg.rotation.x = -0.2;
      target.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), legMat);
    back.position.set(0, 0.55, -0.35);
    back.rotation.x = 0.45;
    target.add(back);
    const arrowGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.7, 5);
    arrowGeo.rotateX(Math.PI / 2);
    const fletch = new THREE.BoxGeometry(0.002, 0.04, 0.1);
    const arrowMat = new THREE.MeshStandardMaterial({ color: '#8a6a43' });
    const fMat = new THREE.MeshStandardMaterial({ color: '#2f6b2a' });
    for (const [ax, ay] of [[0.02, 0.78], [-0.12, 0.7], [0.15, 0.9]]) {
      const a = new THREE.Group();
      const shaft = new THREE.Mesh(arrowGeo, arrowMat);
      shaft.position.z = 0.3;
      const f = new THREE.Mesh(fletch, fMat);
      f.position.z = 0.6;
      const f2 = f.clone(); f2.rotation.z = Math.PI / 2;
      a.add(shaft, f, f2);
      a.position.set(ax, ay, 0.05);
      a.rotation.set((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, 0);
      target.add(a);
    }
    target.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const tx = -4.2, tz = -5.5;
    target.position.set(tx, terrainHeight(tx, tz), tz);
    target.rotation.y = 0.65;
    this.group.add(target);

    // Longbow and quiver resting against the stump
    const bowCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.18, 0.75, 0), new THREE.Vector3(0, 1.5, 0));
    const bow = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 24, 0.012, 6), new THREE.MeshStandardMaterial({ color: '#6b4325', roughness: 0.6 }));
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 1.5, 3), new THREE.MeshStandardMaterial({ color: '#e8e0c8' }));
    string.position.y = 0.75;
    const bowGroup = new THREE.Group();
    bowGroup.add(bow, string);
    bowGroup.position.set(-0.86, 0.0, -0.05);
    bowGroup.rotation.set(0.0, 0.1, -0.16);
    bowGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(bowGroup);

    const quiver = new THREE.Group();
    const qBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 12), new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.8 }));
    qBody.position.y = 0.27;
    quiver.add(qBody);
    for (let i = 0; i < 6; i++) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 4), arrowMat);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.06, 0.03), fMat);
      a.position.set((i % 3 - 1) * 0.025, 0.62, (Math.floor(i / 3) - 0.5) * 0.03);
      f.position.copy(a.position).add(new THREE.Vector3(0, 0.09, 0));
      quiver.add(a, f);
    }
    quiver.position.set(0.8, 0, 0.12);
    quiver.rotation.z = 0.28;
    quiver.rotation.y = 0.2;
    quiver.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(quiver);

    // Campfire in the distance with flickering light
    const fire = new THREE.Group();
    const fx = -6.5, fz = 6.5;
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#77736a', roughness: 0.95 });
    const stoneGeo = rockGeometry(9, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = new THREE.Mesh(stoneGeo, stoneMat);
      s.position.set(Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45);
      s.scale.setScalar(0.12);
      fire.add(s);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: '#3b2817', roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 6), logMat);
      log.rotation.z = Math.PI / 2 - 0.5;
      log.rotation.y = (i / 4) * Math.PI * 2;
      log.position.y = 0.12;
      fire.add(log);
    }
    const flameMat = new THREE.SpriteMaterial({ map: softSprite('#ffb347'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const flames = [];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Sprite(flameMat);
      f.position.set((Math.random() - 0.5) * 0.15, 0.2 + i * 0.05, (Math.random() - 0.5) * 0.15);
      f.scale.set(0.3, 0.45, 1);
      fire.add(f);
      flames.push(f);
    }
    const fireLight = new THREE.PointLight('#ff9a3c', 6, 9, 1.6);
    fireLight.position.y = 0.5;
    fire.add(fireLight);
    fire.position.set(fx, terrainHeight(fx, fz), fz);
    this.group.add(fire);
    // Rising embers
    const emberCount = 40;
    const emberGeo = new THREE.BufferGeometry();
    const ep = new Float32Array(emberCount * 3);
    const eLife = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) eLife[i] = Math.random();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
      size: 0.04, map: softSprite('#ffcc66'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffaa55',
    }));
    fire.add(embers);
    this.updaters.push((dt, t) => {
      fireLight.intensity = 5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 0.9 + Math.random() * 0.5;
      flames.forEach((f, i) => {
        const k = 0.8 + 0.3 * Math.sin(t * (9 + i) + i);
        f.scale.set(0.28 * k, 0.5 * k, 1);
        f.position.y = 0.18 + i * 0.04 + Math.sin(t * 6 + i) * 0.02;
      });
      for (let i = 0; i < emberCount; i++) {
        eLife[i] += dt * (0.3 + (i % 5) * 0.06);
        if (eLife[i] > 1) eLife[i] -= 1;
        const l = eLife[i];
        ep[i * 3] = Math.sin(i * 12.9 + l * 4) * 0.15 * l;
        ep[i * 3 + 1] = 0.2 + l * 2.2;
        ep[i * 3 + 2] = Math.cos(i * 7.1 + l * 3) * 0.15 * l;
      }
      emberGeo.attributes.position.needsUpdate = true;
    });
    this.fireLight = fireLight;
  }

  _particles() {
    const rng = mulberry32(4242);
    // Mist & spray at the base of the waterfall
    const mistMat = new THREE.SpriteMaterial({ map: cloudSprite(), color: '#e8f0f0', transparent: true, opacity: 0.22, depthWrite: false });
    const mists = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(mistMat.clone());
      s.userData = { phase: rng(), speed: 0.12 + rng() * 0.15, x: WATERFALL.x + (rng() - 0.5) * 6, z: WATERFALL.baseZ + 0.5 + rng() * 3 };
      this.group.add(s);
      mists.push(s);
    }
    // Spray droplets
    const sprayN = 300;
    const sprayGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(sprayN * 3);
    const sv = [];
    for (let i = 0; i < sprayN; i++) sv.push({ life: rng(), vx: (rng() - 0.5) * 2, vy: 1 + rng() * 2.5, vz: 0.5 + rng() * 1.5, x0: WATERFALL.x + (rng() - 0.5) * WATERFALL.width });
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ size: 0.12, map: softSprite('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false, color: '#f2fbff' }));
    this.group.add(spray);

    // Fireflies / sunlit dust motes drifting around the clearing
    const ffN = 140;
    const ffGeo = new THREE.BufferGeometry();
    const fp = new Float32Array(ffN * 3);
    const fseed = [];
    for (let i = 0; i < ffN; i++) {
      const a = rng() * Math.PI * 2, d = 0.6 + rng() * 9;
      fseed.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0.3 + rng() * 2.5, p: rng() * 10 });
    }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const ffMat = new THREE.PointsMaterial({ size: 0.05, map: softSprite('#fff3b0'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff1a0', opacity: 0.85 });
    const fireflies = new THREE.Points(ffGeo, ffMat);
    this.group.add(fireflies);

    // Falling oak leaves
    const leafN = 60;
    const leafGeo = new THREE.PlaneGeometry(0.06, 0.08);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#8a7a2a', side: THREE.DoubleSide, roughness: 0.8 });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafN);
    leaves.frustumCulled = false;
    const lstate = [];
    for (let i = 0; i < leafN; i++) {
      lstate.push({ x: (rng() - 0.5) * 16, z: (rng() - 0.5) * 16, y: rng() * 9, s: 0.25 + rng() * 0.3, r: rng() * 6, c: new THREE.Color().setHSL(0.08 + rng() * 0.12, 0.6, 0.3 + rng() * 0.2) });
      leaves.setColorAt(i, lstate[i].c);
    }
    this.group.add(leaves);

    // God-ray light shafts slanting through the canopy
    const shafts = [];
    const shaftGeo = new THREE.CylinderGeometry(0.6, 1.6, 26, 16, 1, true);
    shaftGeo.translate(0, -13, 0);
    const shaftSpots = [[-2.5, -3], [3, -6], [-6, 1.5], [1.5, 4.5], [-3.5, -11], [5.5, -14], [-11, -17]];
    shaftSpots.forEach(([x, z], i) => {
      const mat = createShaftMaterial();
      mat.uniforms.uSeed.value = i * 1.37;
      mat.uniforms.uStrength.value = 0.07 + rng() * 0.06;
      const m = new THREE.Mesh(shaftGeo, mat);
      m.position.set(x, terrainHeight(x, z), z).addScaledVector(this.sunDir, 26);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.sunDir);
      m.renderOrder = 5;
      this.group.add(m);
      shafts.push(m);
    });

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    this.updaters.push((dt, t) => {
      for (const s of mists) {
        const u = s.userData;
        u.phase += dt * u.speed;
        if (u.phase > 1) u.phase -= 1;
        s.position.set(u.x + Math.sin(t * 0.3 + u.z) * 0.8, 0.2 + u.phase * 4.5, u.z + u.phase * 2.5);
        const sc = 3 + u.phase * 6;
        s.scale.set(sc, sc * 0.7, 1);
        s.material.opacity = 0.28 * Math.sin(u.phase * Math.PI);
      }
      for (let i = 0; i < sprayN; i++) {
        const v = sv[i];
        v.life += dt * 0.9;
        if (v.life > 1) v.life -= 1;
        const l = v.life * 1.2;
        sp[i * 3] = v.x0 + v.vx * l;
        sp[i * 3 + 1] = Math.max(0, v.vy * l - 4.9 * l * l) + 0.05;
        sp[i * 3 + 2] = WATERFALL.baseZ + 0.4 + v.vz * l;
      }
      sprayGeo.attributes.position.needsUpdate = true;
      for (let i = 0; i < ffN; i++) {
        const f = fseed[i];
        fp[i * 3] = f.x + Math.sin(t * 0.3 + f.p) * 0.8;
        fp[i * 3 + 1] = f.y + Math.sin(t * 0.5 + f.p * 2) * 0.3;
        fp[i * 3 + 2] = f.z + Math.cos(t * 0.27 + f.p) * 0.8;
      }
      ffGeo.attributes.position.needsUpdate = true;
      ffMat.opacity = 0.55 + 0.3 * Math.sin(t * 2.0);
      for (let i = 0; i < leafN; i++) {
        const L = lstate[i];
        L.y -= dt * L.s;
        L.r += dt * 1.5;
        if (L.y < 0) { L.y = 9 + Math.random() * 3; L.x = (Math.random() - 0.5) * 16; L.z = (Math.random() - 0.5) * 16; }
        const ground = terrainHeightCached(L.x, L.z);
        const y = Math.max(L.y, ground + 0.01);
        e.set(L.r, L.r * 0.7, Math.sin(L.r) * 0.8);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(L.x + Math.sin(t * 0.8 + i) * 0.3, y, L.z + Math.cos(t * 0.6 + i) * 0.3), q, new THREE.Vector3(1, 1, 1));
        leaves.setMatrixAt(i, m4);
      }
      leaves.instanceMatrix.needsUpdate = true;
      for (const s of shafts) s.material.uniforms.uTime.value = t;
    });
  }

  _environmentMap() {
    // Build a small reflection environment from the sky + forest tones for shiny pieces.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(this.sky.clone());
    const ground = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2d3b1c', side: THREE.BackSide }));
    envScene.add(ground);
    // Ring of dark tree silhouettes on the horizon
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? '#263a18' : '#34481f' }));
      m.position.set(Math.cos(a) * 80, 10 + (i % 3) * 6, Math.sin(a) * 80);
      envScene.add(m);
    }
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.4, 4) }));
    sunBall.position.copy(this.sunDir).multiplyScalar(90);
    envScene.add(sunBall);
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 1000);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
  }
}

// Cache for frequently queried terrain heights in animation loops
const hCache = new Map();
function terrainHeightCached(x, z) {
  const k = Math.round(x * 2) * 10000 + Math.round(z * 2);
  let h = hCache.get(k);
  if (h === undefined) { h = terrainHeight(Math.round(x * 2) / 2, Math.round(z * 2) / 2); hCache.set(k, h); }
  return h;
}
