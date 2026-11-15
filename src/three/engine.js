import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function createEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080c);
  scene.fog = new THREE.Fog(0x07080c, 5, 11);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;

  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.02, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.35;
  controls.maxDistance = 2.8;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.minAzimuthAngle = -1.25;
  controls.maxAzimuthAngle = 1.25;
  controls.screenSpacePanning = true;

  // --- tweens ---------------------------------------------------------------
  const tweens = new Set();
  function tween({ duration = 0.5, easing = ease.inOut, onUpdate, delay = 0 }) {
    return new Promise((resolve) => {
      const start = performance.now() + delay * 1000;
      tweens.add({ start, duration: duration * 1000, easing, onUpdate, resolve });
    });
  }

  let cameraTween = 0;
  function flyTo(position, target, duration = 1.0) {
    const id = ++cameraTween;
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    const p1 = position.clone();
    const t1 = target.clone();
    return tween({
      duration,
      onUpdate: (k) => {
        if (id !== cameraTween) return;
        camera.position.lerpVectors(p0, p1, k);
        controls.target.lerpVectors(t0, t1, k);
      },
    });
  }
  controls.addEventListener('start', () => { cameraTween++; });

  // --- loop -------------------------------------------------------------------
  const updaters = new Set();
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const now = performance.now();
    for (const tw of tweens) {
      if (now < tw.start) continue;
      const k = Math.min(1, (now - tw.start) / tw.duration);
      tw.onUpdate?.(tw.easing(k));
      if (k >= 1) { tweens.delete(tw); tw.resolve(); }
    }
    for (const fn of updaters) fn(dt, now / 1000);
    controls.update();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  new ResizeObserver(resize).observe(container);

  return { renderer, scene, camera, controls, tween, flyTo, loop, onUpdate: (fn) => updaters.add(fn) };
}
