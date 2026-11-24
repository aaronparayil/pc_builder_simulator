import * as THREE from 'three';
import { createEngine, ease } from './engine.js';
import { buildRoom, DESK_TOP } from './room.js';
import { buildCase, CASE } from './pcCase.js';
import { createPartObject, preloadModels, slotBox, templates } from './parts.js';
import { getPart } from '../data/catalog.js';
import { buildShowroom } from './showroom.js';
import { createWalker } from './walk.js';

const CASE_POS = new THREE.Vector3(-0.22, DESK_TOP + 0.016, -0.08);
const CASE_ROT_Y = 0.12;

export function createWorkshop(container, { onHover, onSelect, onWalkFocus, onWalkInteract, onWalkLock } = {}) {
  const engine = createEngine(container);
  const { scene, camera, controls, tween, flyTo, renderer } = engine;
  const room = buildRoom(scene);
  const pc = buildCase();
  pc.group.position.copy(CASE_POS);
  pc.group.rotation.y = CASE_ROT_Y;
  scene.add(pc.group);
  engine.onUpdate(pc.update);
  pc.group.userData.interact = { kind: 'bench', label: 'Build at the workbench' };

  // The showroom needs the part models, so it is built once they have loaded.
  let showroom = null;
  let walker = null;
  async function preload(onProgress) {
    await preloadModels(onProgress);
    showroom = buildShowroom(scene);
    engine.onUpdate(showroom.update);
    walker = createWalker(engine, {
      colliders: [...room.colliders, ...showroom.colliders],
      onFocus: (t) => onWalkFocus?.(t),
      onInteract: (t) => onWalkInteract?.(t),
      onLockChange: (locked) => onWalkLock?.(locked),
    });
  }

  const installed = new Map(); // category -> Object3D
  let powered = false;

  const caseCenter = () => pc.group.localToWorld(new THREE.Vector3(0, CASE.H * 0.55, 0));
  const VIEWS = {
    home: () => ({ pos: pc.group.localToWorld(new THREE.Vector3(0.62, 0.55, 1.05)), target: caseCenter() }),
    wide: () => ({ pos: new THREE.Vector3(0.45, 1.5, 2.1), target: new THREE.Vector3(0.05, DESK_TOP + 0.25, -0.1) }),
    front: () => ({ pos: pc.group.localToWorld(new THREE.Vector3(0.95, 0.3, 0.95)), target: caseCenter().add(new THREE.Vector3(0.25, -0.05, 0)) }),
  };
  {
    const v = VIEWS.wide();
    camera.position.copy(v.pos);
    controls.target.copy(v.target);
  }

  function view(name, duration = 1.1) {
    const v = VIEWS[name]();
    return flyTo(v.pos, v.target, duration);
  }

  function focusCategory(category) {
    const box = slotBox(category);
    if (!box) return view('home');
    const target = pc.group.localToWorld(box.center.clone());
    const dist = THREE.MathUtils.clamp(box.size.length() * 2.6, 0.42, 0.9);
    const dir = new THREE.Vector3(0.32, 0.22, 1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), CASE_ROT_Y);
    return flyTo(target.clone().addScaledVector(dir, dist), target, 0.9);
  }

  function showSlot(category) {
    pc.showGhost(category && !installed.has(category) ? slotBox(category) : null);
  }

  // --- installing parts --------------------------------------------------------
  const fanObjects = new Set();

  function install(category, partId, animate = true) {
    remove(category, false);
    const part = getPart(partId);
    const obj = createPartObject(part);
    pc.group.add(obj);
    installed.set(category, obj);
    (obj.userData.fans || []).forEach((f) => fanObjects.add(f));
    if (!animate) return Promise.resolve();
    const end = obj.position.clone();
    const start = end.clone().add(new THREE.Vector3(0.05, 0.18, 0.42));
    obj.position.copy(start);
    obj.rotation.set(0.5, -0.4, 0.2);
    return tween({
      duration: 0.75,
      easing: ease.outBack,
      onUpdate: (k) => {
        obj.position.lerpVectors(start, end, k);
        const r = 1 - Math.min(1, k);
        obj.rotation.set(0.5 * r, -0.4 * r, 0.2 * r);
      },
    });
  }

  function remove(category, animate = true) {
    const obj = installed.get(category);
    if (!obj) return Promise.resolve();
    installed.delete(category);
    (obj.userData.fans || []).forEach((f) => fanObjects.delete(f));
    if (hovered === obj) setHover(null);
    const dispose = () => pc.group.remove(obj);
    if (!animate) { dispose(); return Promise.resolve(); }
    const start = obj.position.clone();
    const end = start.clone().add(new THREE.Vector3(0.05, 0.2, 0.45));
    return tween({
      duration: 0.45,
      easing: ease.inOut,
      onUpdate: (k) => {
        obj.position.lerpVectors(start, end, k);
        obj.scale.setScalar(1 - k * 0.6);
      },
    }).then(dispose);
  }

  /** Make the 3D case match the build. Returns the categories that changed. */
  function sync(build, animate = true) {
    const changed = [];
    for (const [category, partId] of Object.entries(build)) {
      const obj = installed.get(category);
      if (partId && (!obj || obj.userData.partId !== partId)) {
        install(category, partId, animate);
        changed.push(category);
      } else if (!partId && obj) {
        remove(category, animate);
        changed.push(category);
      }
    }
    return changed;
  }

  // --- power ---------------------------------------------------------------------
  let fanSpeed = 0;
  engine.onUpdate((dt, time) => {
    fanSpeed += ((powered ? 1 : 0) - fanSpeed) * Math.min(1, dt * 1.5);
    for (const f of fanObjects) {
      f.userData.rotor.rotation.z += fanSpeed * dt * 30;
      const ring = f.children[1]?.material;
      if (ring) {
        if (fanSpeed > 0.02) ring.color.setHSL((time * 0.12 + 0.3) % 1, 0.9, 0.55).multiplyScalar(0.6 + fanSpeed * 1.6);
        else ring.color.setRGB(0.12, 0.13, 0.15);
      }
    }
    const logo = installed.get('cooler')?.userData.logo;
    if (logo) logo.color.setHSL((time * 0.12 + 0.5) % 1, 0.9, 0.5 * fanSpeed + 0.05);
    for (const obj of installed.values()) {
      (obj.userData.rgb || []).forEach((m, i) => {
        if (fanSpeed > 0.02) m.color.setHSL((time * 0.2 + i * 0.15) % 1, 0.9, 0.55).multiplyScalar(0.5 + fanSpeed * 1.8);
        else m.color.setRGB(0.12, 0.13, 0.15);
      });
    }
  });

  function setPowered(v) {
    powered = v;
    pc.setPowered(v);
  }

  function setGlass(closed, duration = 0.9) {
    const from = pc.glassOpen;
    const to = closed ? 0 : 1;
    if (from === to) return Promise.resolve();
    return tween({ duration, easing: ease.inOut, onUpdate: (k) => pc.setGlassOpen(from + (to - from) * k) });
  }

  // --- flash parts that have problems -------------------------------------------------
  const flashes = [];
  function flash(categories, color = 0xff4d6d) {
    for (const category of categories) {
      const obj = installed.get(category);
      const helper = new THREE.Box3Helper(new THREE.Box3(), color);
      helper.raycast = () => {};
      if (obj) helper.box.setFromObject(obj).expandByScalar(0.004);
      else {
        const b = slotBox(category);
        if (!b) continue;
        const c = pc.group.localToWorld(b.center.clone());
        helper.box.setFromCenterAndSize(c, b.size);
      }
      scene.add(helper);
      flashes.push({ helper, until: performance.now() + 3200 });
    }
  }
  engine.onUpdate((dt, time) => {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.helper.visible = Math.sin(time * 12) > -0.3;
      if (performance.now() > f.until) { scene.remove(f.helper); f.helper.dispose(); flashes.splice(i, 1); }
    }
  });

  // --- picking -------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hoverHelper = new THREE.Box3Helper(new THREE.Box3(), 0x5eead4);
  hoverHelper.visible = false;
  hoverHelper.raycast = () => {};
  scene.add(hoverHelper);
  let hovered = null;

  function setHover(obj) {
    if (obj === hovered) return;
    hovered = obj;
    hoverHelper.visible = Boolean(obj);
    if (obj) hoverHelper.box.setFromObject(obj).expandByScalar(0.003);
    renderer.domElement.style.cursor = obj ? 'pointer' : '';
  }

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...installed.values()], true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !o.userData.category) o = o.parent;
      if (o) return o;
    }
    return null;
  }

  let downAt = null;
  const el = renderer.domElement;
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || walker?.active) return;
    setHover(pick(e));
    onHover?.(hovered ? hovered.userData.category : null, e.clientX, e.clientY);
  });
  el.addEventListener('pointerleave', () => { setHover(null); onHover?.(null); });
  el.addEventListener('pointerdown', (e) => { downAt = walker?.active ? null : [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 6) return;
    const obj = pick(e);
    if (obj) onSelect?.(obj.userData.category);
  });

  return {
    engine,
    monitor: room.monitor,
    roomSolids: room.solids,
    preload,
    get walker() { return walker; },
    get colliders() { return [...room.colliders, ...(showroom?.colliders || [])]; },
    lights: room.lights,
    get showroom() { return showroom; },
    sync,
    focusCategory,
    showSlot,
    view,
    setPowered,
    setGlass,
    flash,
    renderer,
    installed,
    templates,
    pc,
    camera,
    controls,
    get installedCount() { return installed.size; },
  };
}
