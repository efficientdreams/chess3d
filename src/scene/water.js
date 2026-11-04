// Shader materials for the river, pool and waterfall.
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */`
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
`;

export function createWaterMaterial({ flowSpeed = 0.6, deep = '#0f3a3a', shallow = '#3d7a68', foamEdges = true } = {}) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uFlow: { value: flowSpeed },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uSky: { value: new THREE.Color('#9fbcb8') },
      uSunDir: { value: new THREE.Vector3(-0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color('#fff2d0') },
      uFoamEdges: { value: foamEdges ? 1 : 0 },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    fog: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uTime, uFlow, uFoamEdges;
      uniform vec3 uDeep, uShallow, uSky, uSunDir, uSunColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        // uv.x across the river (0..1), uv.y along the river in metres
        vec2 p1 = vec2(vUv.x * 3.0, vUv.y * 0.6 - uTime * uFlow);
        vec2 p2 = vec2(vUv.x * 5.0 + 3.0, vUv.y * 1.1 - uTime * uFlow * 1.4);
        float h1 = fbm(p1 * 2.0);
        float h2 = fbm(p2 * 3.0);
        float e = 0.05;
        float hx = fbm((p1 + vec2(e, 0.0)) * 2.0) - h1 + fbm((p2 + vec2(e, 0.0)) * 3.0) - h2;
        float hy = fbm((p1 + vec2(0.0, e)) * 2.0) - h1 + fbm((p2 + vec2(0.0, e)) * 3.0) - h2;
        vec3 n = normalize(vec3(-hx * 6.0, 1.0, -hy * 6.0));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.6, edge));
        col = mix(col, uSky, clamp(fres * 0.6 + 0.05, 0.0, 0.8));
        vec3 h = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(n, h), 0.0), 120.0) * 1.6;
        col += uSunColor * spec;
        // ripples & foam streaks
        float streak = smoothstep(0.62, 0.8, fbm(vec2(vUv.x * 9.0, vUv.y * 0.35 - uTime * uFlow * 1.2)));
        float foam = streak * 0.18;
        foam += uFoamEdges * smoothstep(0.12, 0.0, edge) * (0.3 + 0.5 * fbm(vec2(vUv.x * 20.0, vUv.y * 2.0 - uTime * uFlow * 2.0)));
        col = mix(col, vec3(0.92, 0.96, 0.95), clamp(foam, 0.0, 0.85));
        float alpha = mix(0.55, 0.92, smoothstep(0.0, 0.3, edge)) + fres * 0.1;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

export function createWaterfallMaterial() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uTime: { value: 0 }, uSpeed: { value: 1.0 } },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    fog: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uTime, uSpeed;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        // vUv.y = 1 at the lip, 0 at the base.
        float fall = 1.0 - vUv.y;
        float speed = uSpeed * (0.7 + fall * 1.6);
        float streaks = fbm(vec2(vUv.x * 26.0, vUv.y * 2.5 + uTime * speed * 1.6));
        float fine = fbm(vec2(vUv.x * 70.0, vUv.y * 6.0 + uTime * speed * 2.6));
        float v = streaks * 0.7 + fine * 0.5;
        vec3 deep = vec3(0.32, 0.5, 0.52);
        vec3 white = vec3(0.95, 0.98, 1.0);
        vec3 col = mix(deep, white, smoothstep(0.35, 0.8, v));
        float sideFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float bottomFoam = smoothstep(0.12, 0.0, vUv.y);
        col = mix(col, white, bottomFoam);
        float alpha = (0.55 + v * 0.45) * sideFade;
        alpha *= mix(1.0, 0.7, smoothstep(0.85, 1.0, vUv.y));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// Simple additive light-shaft material.
export function createShaftMaterial(color = '#fff1c4') {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSeed: { value: 0 }, uStrength: { value: 0.12 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vN; varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uSeed, uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vN; varying vec3 vView;
      void main() {
        float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float rim = pow(abs(dot(normalize(vN), normalize(vView))), 1.5);
        float flicker = 0.75 + 0.25 * sin(uTime * 0.4 + uSeed * 6.0) * sin(uTime * 0.23 + uSeed);
        float a = along * rim * flicker * uStrength;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
}
