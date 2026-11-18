import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ROOM } from './room.js';

const EYE = 1.6;
const RADIUS = 0.3;
const SPEED = 2.2;
const SPRINT = 4;
const REACH = 3.2;

/**
 * First-person walking: WASD / arrows to move, mouse to look (pointer lock),
 * Shift to run, E to interact with whatever is under the crosshair.
 */
export function createWalker(engine, { colliders, onFocus, onInteract, onLockChange }) {
  const { camera, renderer, scene, controls: orbit } = engine;
  const look = new PointerLockControls(camera, renderer.domElement);
  look.pointerSpeed = 0.8;

  const keys = new Set();
  const velocity = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  raycaster.far = REACH;
  const center = new THREE.Vector2(0, 0);
  let active = false;
  let focused = null;
  let bobT = 0;
  let scanIn = 0;
  // Fallback when the browser refuses pointer lock (embedded views, some iframes):
  // drag with the mouse to look, keys still move.
  let dragLook = false;
  let lockTimer = 0;
  const engaged = () => look.isLocked || dragLook;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  let saved = null;

  function blocked(x, z) {
    if (x < ROOM.minX + RADIUS || x > ROOM.maxX - RADIUS || z < ROOM.minZ + RADIUS || z > ROOM.maxZ - RADIUS) return true;
    return colliders.some((b) => x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS);
  }

  function findInteract(obj) {
    for (let o = obj; o; o = o.parent) if (o.userData.interact) return { object: o, ...o.userData.interact };
    return null;
  }

  function setFocus(next) {
    if (next?.object === focused?.object) return;
    focused = next;
    onFocus?.(focused);
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  function update(dt) {
    if (!active) return;
    // Movement relative to where you're looking, flattened onto the floor
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const want = new THREE.Vector3();
    if (engaged()) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) want.add(forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) want.sub(forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) want.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) want.sub(right);
    }
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT : SPEED;
    if (want.lengthSq()) want.normalize().multiplyScalar(speed);
    velocity.lerp(want, Math.min(1, dt * 10));
    const p = camera.position;
    const nx = p.x + velocity.x * dt;
    const nz = p.z + velocity.z * dt;
    if (!blocked(nx, p.z)) p.x = nx; else velocity.x = 0;
    if (!blocked(p.x, nz)) p.z = nz; else velocity.z = 0;
    const moving = velocity.length();
    bobT += dt * moving * 3.2;
    p.y = EYE + Math.sin(bobT) * 0.018 * Math.min(1, moving / SPEED);

    // What's under the crosshair? (throttled: the part models are dense meshes)
    scanIn -= dt;
    if (engaged() && scanIn <= 0) {
      scanIn = 0.1;
      raycaster.setFromCamera(center, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      let found = null;
      for (const h of hits) {
        if (!h.object.visible) continue;
        found = findInteract(h.object);
        break; // the first solid thing blocks anything behind it
      }
      setFocus(found);
    } else if (!engaged()) setFocus(null);
  }

  function onKeyDown(e) {
    if (!active) return;
    keys.add(e.code);
    if (e.code === 'Escape' && dragLook) { stopDragLook(); return; }
    if (e.code === 'KeyE' && focused && engaged()) onInteract?.(focused);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());
  look.addEventListener('lock', () => { clearTimeout(lockTimer); dragLook = false; onLockChange?.(true); });
  look.addEventListener('unlock', () => { if (dragLook) return; keys.clear(); onLockChange?.(false); });

  function startDragLook() {
    if (!active || look.isLocked || dragLook) return;
    dragLook = true;
    onLockChange?.(true);
  }
  function stopDragLook() {
    if (!dragLook) return;
    dragLook = false;
    keys.clear();
    onLockChange?.(false);
  }
  document.addEventListener('pointerlockerror', startDragLook);
  let dragging = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { if (dragLook) { dragging = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); } });
  el.addEventListener('pointermove', (e) => {
    if (!dragLook || !dragging) return;
    const dx = e.clientX - dragging[0], dy = e.clientY - dragging[1];
    dragging = [e.clientX, e.clientY];
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= dx * 0.004;
    euler.x = THREE.MathUtils.clamp(euler.x - dy * 0.004, -1.45, 1.45);
    camera.quaternion.setFromEuler(euler);
  });
  el.addEventListener('pointerup', () => { dragging = null; });

  engine.onUpdate(update);

  function enter({ position = new THREE.Vector3(0.4, EYE, 2.6), lookAt = new THREE.Vector3(-0.1, 1.0, 0) } = {}) {
    if (active) return;
    engine.cancelFly();
    saved = { pos: camera.position.clone(), target: orbit.target.clone(), fov: camera.fov };
    active = true;
    engine.state.orbit = false;
    orbit.enabled = false;
    camera.position.copy(position);
    camera.lookAt(lookAt);
    camera.fov = 68;
    camera.updateProjectionMatrix();
    velocity.set(0, 0, 0);
  }

  function exit() {
    if (!active) return;
    active = false;
    if (look.isLocked) look.unlock();
    stopDragLook();
    setFocus(null);
    keys.clear();
    camera.fov = saved.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(saved.pos);
    orbit.target.copy(saved.target);
    camera.lookAt(saved.target);
    orbit.enabled = true;
    engine.state.orbit = true;
  }

  return {
    enter,
    exit,
    lock: () => {
      if (!active) return;
      look.lock();
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => { if (!look.isLocked) startDragLook(); }, 350);
    },
    unlock: () => { if (look.isLocked) look.unlock(); stopDragLook(); },
    get active() { return active; },
    get locked() { return engaged(); },
    get dragLook() { return dragLook; },
  };
}
