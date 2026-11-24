import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { ROOM } from './room.js';
import { makeBlocker } from './walk.js';
import { createPanel } from './vrPanel.js';
import { createVRUI } from '../ui/vrViews.js';
import { carryZoom, createHeldPart } from './parts.js';
import { createPhysics } from './physics.js';
import { CASE } from './pcCase.js';
import { DESK_TOP } from './room.js';
import { getPart } from '../data/catalog.js';
import { REQUIRES } from '../logic/analyze.js';

const MOVE_SPEED = 2;
const SNAP = Math.PI / 6; // 30°
const REACH = 8;
const ENTRANCE = new THREE.Vector3(2.4, 0, 7.4);
const BENCH_SPOT = new THREE.Vector3(0.1, 0, 1.15);
const GRAB_REACH = 5; // metres: point at a part and squeeze to pull it to your hand
const TOUCH = 0.09; // metres from the controller to a part's box to grab it directly
const SNAP_DIST = 0.14; // how close a held part must be to its slot to install
// Parts are carried at their shelf/display size (small parts enlarged) and shrink
// back to real size as they approach their slot.
const SHRINK_FROM = 0.45; // metres from the slot where shrinking starts
const PUT_BACK = 0.25; // let go this close to where a shelf part came from and it goes back
const THROW_BOOST = 1.15; // a little extra so throws feel like they carry
const TEAL = 0x5eead4, GREEN = 0x4ade80, RED = 0xff4d6d;

/**
 * Room-scale VR on top of the same scene: controllers with laser pointers, thumbstick
 * walking with collisions, snap turning, teleporting, and an in-world panel for
 * everything the desktop does with HTML (build menu, comparisons, posters, results).
 */
export function createVR(workshop, hooks) {
  const { engine } = workshop;
  const { renderer, scene, camera, controls, rig } = engine;
  const blocked = makeBlocker(workshop.colliders, 0.25);

  const panel = createPanel();
  scene.add(panel.group);
  const ui = createVRUI(panel, { ...hooks, onOpen: placePanel });

  let active = false;
  let saved = null;

  // --- controllers ---------------------------------------------------------------
  const factory = new XRControllerModelFactory();
  const handFactory = new XRHandModelFactory();
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const ringGeo = new THREE.RingGeometry(0.16, 0.2, 40).rotateX(-Math.PI / 2);
  const dotGeo = new THREE.SphereGeometry(0.012, 12, 8);

  const pointers = [0, 1].map((i) => {
    const ctrl = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(factory.createControllerModel(grip));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(lineGeo, lineMat);
    line.scale.z = REACH;
    line.raycast = () => {};
    ctrl.add(line);
    rig.add(ctrl, grip);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }));
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    ring.visible = dot.visible = false;
    ring.raycast = dot.raycast = () => {};
    scene.add(ring, dot);
    // Hand tracking (controllers put down): simple joint spheres, pinch to grab
    const hand = renderer.xr.getHand(i);
    hand.add(handFactory.createHandModel(hand, 'spheres'));
    rig.add(hand);
    const p = { ctrl, grip, line, lineMat, ring, dot, source: null, hit: null, scan: 0, lastScan: null, turnReady: true, held: null, menuDown: false, pinched: false };
    const isHand = () => Boolean(p.source?.hand);
    ctrl.addEventListener('connected', (e) => { p.source = e.data; line.visible = e.data.targetRayMode !== 'gaze'; });
    ctrl.addEventListener('disconnected', () => { if (p.held) release(p); p.source = null; p.pinched = false; });
    ctrl.addEventListener('selectstart', () => {
      if (p.held) return;
      // a pinch is both "grab" and "click" for hands: grab if there's a part, else select
      if (isHand()) { tryGrab(p); if (p.held) { p.pinched = true; return; } }
      select(p);
    });
    ctrl.addEventListener('selectend', () => { if (p.pinched) { p.pinched = false; if (p.held) release(p); } });
    ctrl.addEventListener('squeezestart', () => tryGrab(p));
    ctrl.addEventListener('squeezeend', () => { if (p.held && !p.pinched) release(p); });
    return p;
  });

  // --- helpers -------------------------------------------------------------------
  const head = new THREE.Vector3();
  const headDir = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();

  function headPose() {
    camera.getWorldPosition(head);
    camera.getWorldDirection(headDir);
    headDir.y = 0;
    if (headDir.lengthSq() < 1e-6) headDir.set(0, 0, -1);
    headDir.normalize();
  }

  /** Put the panel about an arm's length in front of the player, facing them. */
  function placePanel(force = false) {
    if (!active) return;
    headPose();
    const target = head.clone().addScaledVector(headDir, 0.95);
    if (!force && panel.visible && panel.group.position.distanceTo(head) < 2.2) return;
    panel.group.position.set(target.x, Math.max(1.0, head.y - 0.12), target.z);
    panel.group.lookAt(head.x, panel.group.position.y, head.z);
  }

  function moveRig(dx, dz) {
    headPose();
    if (!blocked(head.x + dx, head.z)) rig.position.x += dx;
    if (!blocked(head.x, head.z + dz)) rig.position.z += dz;
  }

  /** Move so the player's head ends up over `point`, optionally facing `look`. */
  function teleport(point, look = null) {
    headPose();
    if (look) {
      // turn the rig so the head faces `look`, pivoting around the head
      const want = Math.atan2(-(look.x - point.x), -(look.z - point.z));
      const have = Math.atan2(-headDir.x, -headDir.z);
      turn(want - have);
      headPose();
    }
    rig.position.x += point.x - head.x;
    rig.position.z += point.z - head.z;
    hooks.whoosh?.();
  }

  function turn(angle) {
    headPose();
    const pivot = head.clone();
    rig.position.sub(pivot).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(pivot);
    rig.rotation.y += angle;
  }

  function toggleMenu() {
    if (!active) return;
    if (panel.visible && ui.state.view === 'build') panel.hide();
    else { ui.open('build'); placePanel(true); }
  }

  function findInteract(obj) {
    for (let o = obj; o; o = o.parent) if (o.userData.interact) return o.userData.interact;
    return null;
  }

  const sceneTargets = () => scene.children.filter((c) => c !== rig && c !== panel.group && c !== label && !c.isLight && c.visible && !c.userData.held);

  function interact(target) {
    hooks.click?.();
    if (target.kind === 'bench') {
      teleport(BENCH_SPOT, new THREE.Vector3(-0.1, 0, -0.2));
      ui.open('build');
      placePanel(true);
    } else if (target.kind === 'cabinet') ui.open('build', { category: target.category, highlight: null });
    else if (target.kind === 'part') ui.open('build', { category: target.category, highlight: target.partId });
    else if (target.kind === 'poster') ui.open('poster', { posterId: target.id });
    else if (target.kind === 'compare') ui.open('compare', { cmpCat: 'gpu', baseline: null });
    else if (target.kind === 'challenges') ui.open('challenges');
  }

  function select(p) {
    if (!active || !p.hit) return;
    if (p.hit.type === 'panel') ui.handle(p.hit.id);
    else if (p.hit.type === 'interact') interact(p.hit.target);
    else if (p.hit.type === 'floor') teleport(p.hit.point);
  }

  // --- per-frame -------------------------------------------------------------------
  engine.onUpdate((dt) => {
    if (!active) return;
    physics?.step(dt);
    let hover = null;
    labelOwner = null;
    for (const p of pointers) {
      p.ring.visible = p.dot.visible = false;
      if (!p.source || p.source.targetRayMode === 'screen') { p.hit = null; continue; }
      p.ctrl.updateMatrixWorld(true);
      raycaster.ray.origin.setFromMatrixPosition(p.ctrl.matrixWorld);
      rot.extractRotation(p.ctrl.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rot);
      raycaster.far = REACH;
      p.hit = null;
      let dist = REACH;

      if (panel.visible) {
        const h = raycaster.intersectObject(panel.mesh)[0];
        if (h) {
          p.hit = { type: 'panel', id: panel.hit(h.uv) };
          dist = h.distance;
          hover = hover || p.hit.id;
          p.dot.position.copy(h.point);
          p.dot.visible = true;
        }
      }
      if (!p.hit) {
        p.scan -= dt;
        if (p.scan <= 0) {
          p.scan = 0.08;
          const h = raycaster.intersectObjects(sceneTargets(), true).find((x) => x.object.visible);
          p.lastScan = h ? { target: findInteract(h.object), grab: refineCaseGrab(findGrab(h.object), raycaster.ray, h.distance), point: h.point.clone(), distance: h.distance } : null;
        }
        if (p.lastScan?.target) {
          p.hit = { type: 'interact', target: p.lastScan.target };
          dist = p.lastScan.distance;
          p.dot.position.copy(p.lastScan.point);
          p.dot.visible = true;
        }
      }
      if (!p.hit && raycaster.ray.direction.y < -0.08) {
        const t = -raycaster.ray.origin.y / raycaster.ray.direction.y;
        const point = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, t);
        // rugs and mats lie on the floor; only things standing up block a teleport
        const solid = p.lastScan && p.lastScan.point.y > 0.05 && p.lastScan.distance < t;
        if (t < REACH && !solid && !blocked(point.x, point.z)) {
          p.hit = { type: 'floor', point };
          dist = t;
          p.ring.position.set(point.x, 0.02, point.z);
          p.ring.visible = true;
        } else if (p.lastScan) dist = p.lastScan.distance;
      } else if (!p.hit && p.lastScan) dist = p.lastScan.distance;

      p.line.scale.z = dist;
      p.lineMat.color.set(p.hit?.type === 'panel' || p.hit?.type === 'interact' ? 0xffffff : 0x5eead4);

      // face buttons (A/B/X/Y) toggle the build menu
      const gp = p.source.gamepad;
      const menuNow = Boolean(gp?.buttons?.[4]?.pressed || gp?.buttons?.[5]?.pressed);
      if (menuNow && !p.menuDown) toggleMenu();
      p.menuDown = menuNow;
      if (p.held) updateHeld(p);
      else if (!labelOwner && p.lastScan?.grab && p.hit?.type === 'interact') { showLabel(p.lastScan.grab, p.lastScan.point); labelOwner = p; }

      // thumbsticks: left walks, right snap-turns
      if (gp) {
        const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] || 0;
        const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] || 0;
        if (p.source.handedness === 'left') {
          if (Math.hypot(ax, ay) > 0.15) {
            headPose();
            const right = new THREE.Vector3(-headDir.z, 0, headDir.x);
            const v = headDir.clone().multiplyScalar(-ay).addScaledVector(right, ax).multiplyScalar(MOVE_SPEED * dt);
            moveRig(v.x, v.z);
          }
        } else if (Math.abs(ax) > 0.7 && p.turnReady) {
          turn(-Math.sign(ax) * SNAP);
          p.turnReady = false;
        } else if (Math.abs(ax) < 0.3) p.turnReady = true;
      }
    }
    panel.setHover(hover);
    if (!labelOwner && !noticeUntil) label.visible = false;
    if (noticeUntil && performance.now() > noticeUntil) { noticeUntil = 0; label.visible = false; }
  });

  // --- grabbing parts -------------------------------------------------------------------
  const pc = workshop.pc;
  const caseQuat = new THREE.Quaternion();
  const tmpBox = new THREE.Box3();
  const gripPos = new THREE.Vector3();

  /** What, if anything, can be picked up from this object (walks up the hierarchy). */
  function findGrab(obj) {
    for (let o = obj; o; o = o.parent) {
      if (o.userData.loose) return { source: 'loose', partId: o.userData.partId, object: o };
      if (o.userData.grab) return { source: 'table', partId: o.userData.grab.partId, object: o };
      if (o.userData.interact?.kind === 'part') return { source: 'display', partId: o.userData.interact.partId, object: o };
      if (o.parent === pc.group && o.userData.partId && o.userData.partId !== 'stock') return { source: 'case', partId: o.userData.partId, object: o };
      if (o === pc.group || o === scene) return null;
    }
    return null;
  }

  let touchables = null;
  function touchCandidates() {
    if (!touchables) {
      touchables = [];
      workshop.showroom?.root.traverse((o) => {
        if (o.userData.grab || (o.userData.interact?.kind === 'part' && !o.isMesh)) {
          touchables.push({ box: new THREE.Box3().setFromObject(o), grab: findGrab(o) });
        }
      });
    }
    // The case is turned on the desk, so world-axis boxes around its parts would be
    // inflated and overlap; measure installed parts in the case's own frame instead.
    pc.group.updateMatrixWorld(true);
    caseInv.copy(pc.group.matrixWorld).invert();
    const installed = [...workshop.installed.values()]
      .filter((o) => o.userData.partId !== 'stock')
      .map((o) => ({ box: caseLocalBox(o), grab: findGrab(o), local: true }));
    const loose = (physics?.bodies || []).map((b) => ({ box: new THREE.Box3().setFromObject(b.object), grab: findGrab(b.object) }));
    return [...installed, ...loose, ...touchables];
  }

  /**
   * Thin parts are easy to miss with a laser (aim at a RAM kit and the ray slips
   * between the sticks onto the board). If the ray passes through a smaller
   * installed part's box before reaching what it hit, grab that part instead.
   */
  function refineCaseGrab(grab, ray, hitDistance) {
    if (!grab || grab.source !== 'case' || grab.object.userData.category !== 'motherboard') return grab;
    pc.group.updateMatrixWorld(true);
    caseInv.copy(pc.group.matrixWorld).invert();
    const local = ray.clone().applyMatrix4(caseInv);
    const hitPoint = new THREE.Vector3();
    const size = new THREE.Vector3();
    let best = grab, bestVol = Infinity;
    for (const o of workshop.installed.values()) {
      if (o.userData.partId === 'stock') continue;
      const box = caseLocalBox(o);
      if (!local.intersectBox(box, hitPoint)) continue;
      if (hitPoint.distanceTo(local.origin) > hitDistance + 0.01) continue;
      box.getSize(size);
      const vol = size.x * size.y * size.z;
      if (vol < bestVol) { bestVol = vol; best = findGrab(o); }
    }
    return best;
  }

  const caseInv = new THREE.Matrix4();
  const meshToCase = new THREE.Matrix4();
  function caseLocalBox(obj) {
    const box = new THREE.Box3();
    obj.updateMatrixWorld(true);
    obj.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      meshToCase.multiplyMatrices(caseInv, n.matrixWorld);
      box.union(n.geometry.boundingBox.clone().applyMatrix4(meshToCase));
    });
    return box;
  }

  function haptic(p, intensity = 0.5, ms = 40) {
    p.source?.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
  }

  function tryGrab(p) {
    if (!active || p.held) return;
    // 1) something within reach of the hand
    p.grip.getWorldPosition(gripPos);
    // Prefer a part the hand is inside; parts nest (the CPU sits inside the board's
    // box), so among those take the smallest. Otherwise take the nearest in reach.
    let best = null, bestKey = [Infinity, Infinity];
    const size = new THREE.Vector3();
    const candidates = touchCandidates();
    const gripInCase = pc.group.worldToLocal(gripPos.clone());
    for (const c of candidates) {
      const d = c.box.distanceToPoint(c.local ? gripInCase : gripPos);
      if (!c.grab || d > TOUCH) continue;
      c.box.getSize(size);
      const key = [d, size.x * size.y * size.z];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { best = c.grab; bestKey = key; }
    }
    // 2) otherwise whatever the laser points at
    const pulled = !best;
    if (!best && p.lastScan?.grab && p.lastScan.distance < GRAB_REACH) best = p.lastScan.grab;
    if (!best) return;
    grab(p, best, pulled);
  }

  async function grab(p, target, pulled) {
    const part = getPart(target.partId);
    if (!part) return;
    const start = new THREE.Vector3();
    if (target.source === 'loose') {
      // a part lying where it was thrown: pick that very object back up
      const holder = target.object;
      physics.remove(holder);
      holder.userData.loose = false;
      holder.userData.held = true;
      holder.traverse((o) => { o.raycast = () => {}; });
      holder.getWorldPosition(start);
      p.grip.attach(holder);
      if (pulled) pullToHand(p, holder);
      const { zoom, slotCenter } = holder.userData;
      p.held = { holder, part, slotCenter, source: 'loose', from: start, ready: false, zoom, scale: holder.scale.x, trail: [] };
      label.visible = false;
      haptic(p, 0.6, 50);
      hooks.click?.();
      return;
    }
    if (target.source === 'case') {
      if (hooks.isBusy()) return;
      tmpBox.setFromObject(target.object).getCenter(start);
      await hooks.remove(part.category, { animate: false });
    } else {
      tmpBox.setFromObject(target.object).getCenter(start);
    }
    const { holder, target: slotCenter } = createHeldPart(part);
    holder.userData.held = true;
    holder.traverse((o) => { o.raycast = () => {}; });
    pc.group.getWorldQuaternion(caseQuat);
    holder.position.copy(start);
    holder.quaternion.copy(caseQuat);
    scene.add(holder);
    p.grip.attach(holder);
    if (pulled) pullToHand(p, holder);
    // keep the size it had on the shelf, so picking it up doesn't make it jump
    const zoom = target.object.userData.zoom || carryZoom(holder.userData.size);
    const scale = target.source === 'case' ? 1 : zoom;
    holder.scale.setScalar(scale);
    Object.assign(holder.userData, { zoom, slotCenter });
    p.held = { holder, part, slotCenter, source: target.source, from: start, ready: false, zoom, scale, trail: [] };
    label.visible = false;
    haptic(p, 0.6, 50);
    hooks.click?.();
  }

  /** Fly a part into the hand, just in front of the controller. */
  function pullToHand(p, holder) {
    const from = holder.position.clone();
    const to = new THREE.Vector3(0, -0.02, -0.1);
    engine.tween({ duration: 0.25, onUpdate: (k) => { if (p.held?.holder === holder) holder.position.lerpVectors(from, to, k); } });
  }

  // --- throwing ----------------------------------------------------------------------
  let physics = null;
  function getPhysics() {
    if (physics) return physics;
    // furniture as boxes: the desk, the monitor, the case on the desk, and the showroom
    pc.group.updateMatrixWorld(true);
    const caseBox = new THREE.Box3(new THREE.Vector3(-CASE.D / 2, 0, -CASE.W / 2), new THREE.Vector3(CASE.D / 2, CASE.H, CASE.W / 2)).applyMatrix4(pc.group.matrixWorld);
    const desk = workshop.colliders[0];
    const solids = [
      new THREE.Box3(new THREE.Vector3(desk.minX, 0, desk.minZ + 0.05), new THREE.Vector3(desk.maxX, DESK_TOP, desk.maxZ - 0.03)),
      new THREE.Box3().setFromObject(workshop.monitor.group),
      caseBox,
      ...(workshop.showroom?.solids || []),
      ...(workshop.roomSolids || []),
    ];
    physics = createPhysics({ solids, room: ROOM, onImpact: (body, speed) => hooks.thud?.(Math.min(1, speed / 4)) });
    return physics;
  }

  /** Hand velocity from the last ~80 ms of the held part's motion. */
  function throwVelocity(held) {
    const now = held.trail[held.trail.length - 1];
    const vel = new THREE.Vector3(), spin = new THREE.Vector3();
    if (!now) return { vel, spin };
    const old = held.trail.find((s) => now.t - s.t <= 0.08) || now;
    const dt = now.t - old.t;
    if (dt < 0.008) return { vel, spin };
    vel.subVectors(now.pos, old.pos).divideScalar(dt).multiplyScalar(THROW_BOOST);
    const dq = now.quat.clone().multiply(old.quat.clone().invert());
    const angle = 2 * Math.acos(Math.min(1, Math.abs(dq.w)));
    if (angle > 1e-3) {
      spin.set(dq.x, dq.y, dq.z).normalize().multiplyScalar((dq.w < 0 ? -1 : 1) * angle / dt);
      spin.clampLength(0, 18);
    }
    vel.clampLength(0, 12);
    return { vel, spin };
  }

  function letGo(holder, held) {
    const { vel, spin } = throwVelocity(held);
    holder.userData.held = false;
    holder.userData.loose = true;
    holder.traverse((o) => { delete o.raycast; });
    // local half extents; the object's own scale (shelf zoom) is applied by its matrix
    const half = holder.userData.size.clone().multiplyScalar(0.5);
    getPhysics().add(holder, half, vel, spin);
  }

  function canInstall(part) {
    const build = hooks.getBuild();
    return REQUIRES[part.category].every((r) => build[r]) && !hooks.isBusy();
  }

  function updateHeld(p) {
    const { holder, part, slotCenter } = p.held;
    // remember recent motion, for the throw
    const t = performance.now() / 1000;
    p.held.trail.push({ t, pos: holder.getWorldPosition(new THREE.Vector3()), quat: holder.getWorldQuaternion(new THREE.Quaternion()) });
    while (p.held.trail.length > 2 && t - p.held.trail[0].t > 0.15) p.held.trail.shift();
    const targetWorld = pc.group.localToWorld(slotCenter.clone());
    const d = holder.getWorldPosition(new THREE.Vector3()).distanceTo(targetWorld);
    const ok = canInstall(part);
    const ready = ok && d < SNAP_DIST;
    // real size at the slot, magnified when carried away from it
    const k = THREE.MathUtils.smoothstep(d, SNAP_DIST, SHRINK_FROM);
    const want = 1 + (p.held.zoom - 1) * k;
    p.held.scale += (want - p.held.scale) * 0.2;
    holder.scale.setScalar(p.held.scale);
    if (ready && !p.held.ready) haptic(p, 0.3, 25);
    p.held.ready = ready;
    pc.showGhost({ center: slotCenter, size: holder.userData.size.clone().addScalar(0.01) });
    pc.setGhostColor(!ok ? RED : ready ? GREEN : TEAL);
  }

  function finishHeld() {
    pc.showGhost(null);
    pc.setGhostColor(TEAL);
    hooks.refreshSlot?.();
  }

  function release(p) {
    const held = p.held;
    p.held = null;
    const { holder, part } = held;
    scene.attach(holder);
    if (held.ready) {
      // glide into the slot, then hand over to the normal install
      const p0 = holder.position.clone(), q0 = holder.quaternion.clone(), s0 = holder.scale.x;
      const p1 = pc.group.localToWorld(held.slotCenter.clone());
      pc.group.getWorldQuaternion(caseQuat);
      const q1 = caseQuat.clone();
      engine.tween({ duration: 0.22, onUpdate: (k) => { holder.position.lerpVectors(p0, p1, k); holder.quaternion.slerpQuaternions(q0, q1, k); holder.scale.setScalar(s0 + (1 - s0) * k); } })
        .then(async () => {
          const ok = await hooks.install(part.id, { animate: false });
          scene.remove(holder);
          if (ok) { haptic(p, 0.8, 60); hooks.installSound?.(); }
        });
    } else {
      const near = holder.position.distanceTo(pc.group.localToWorld(held.slotCenter.clone())) < SNAP_DIST * 2;
      if (near && !canInstall(part)) {
        const need = REQUIRES[part.category].filter((r) => !hooks.getBuild()[r]);
        notice(need.length ? `Install the ${need.map((r) => r === 'cpu' ? 'CPU' : r).join(' and ')} first` : 'Shut the PC down first', holder.position);
        hooks.errorSound?.();
        haptic(p, 0.9, 120);
      }
      const fromShelf = held.source === 'table' || held.source === 'display';
      if (fromShelf && holder.position.distanceTo(held.from) < PUT_BACK && throwVelocity(held).vel.length() < 0.8) {
        // let go where it came from: it goes back on the shelf
        const p0 = holder.position.clone(), p1 = held.from, s0 = holder.scale.x;
        engine.tween({ duration: 0.3, onUpdate: (k) => { holder.position.lerpVectors(p0, p1, k); holder.scale.setScalar(Math.max(0.01, s0 * (1 - k))); } })
          .then(() => scene.remove(holder));
      } else {
        // anywhere else it is a real object: it flies with the hand, falls and lands
        letGo(holder, held);
      }
    }
    finishHeld();
  }

  // Floating name tag for whatever the laser is on, and short notices
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 768; labelCanvas.height = 160;
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.08), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, toneMapped: false, depthTest: false }));
  label.renderOrder = 20;
  label.visible = false;
  label.raycast = () => {};
  scene.add(label);
  let labelOwner = null;
  let labelKey = '';
  let noticeUntil = 0;

  function drawLabel(title, sub, color = '#5eead4') {
    const key = title + sub + color;
    if (key === labelKey) return;
    labelKey = key;
    const ctx = labelCanvas.getContext('2d');
    ctx.clearRect(0, 0, 768, 160);
    ctx.fillStyle = 'rgba(13,15,21,0.92)';
    ctx.beginPath(); ctx.roundRect(0, 0, 768, 160, 28); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(0, 24, 8, 112);
    ctx.fillStyle = '#e6edf3'; ctx.font = '700 52px "Space Grotesk", sans-serif';
    ctx.fillText(title, 32, 70, 704);
    ctx.fillStyle = '#8b95a7'; ctx.font = '500 34px "JetBrains Mono", monospace';
    ctx.fillText(sub, 32, 124, 704);
    labelTex.needsUpdate = true;
  }

  function placeLabel(point) {
    headPose();
    label.position.set(point.x, point.y + 0.12, point.z).lerp(head, 0.15);
    label.lookAt(head);
    label.visible = true;
  }

  function showLabel(grab, point) {
    if (noticeUntil) return;
    const part = getPart(grab.partId);
    if (!part) return;
    drawLabel(part.name, `$${part.price} · ${grab.source === 'case' ? 'grip to take out' : 'grip to grab'}`);
    placeLabel(point);
  }

  function notice(text, point) {
    drawLabel(text, 'then try again', '#ff4d6d');
    placeLabel(point);
    noticeUntil = performance.now() + 2200;
  }

  // --- session lifecycle --------------------------------------------------------------
  let vrOffLights = [];
  renderer.xr.addEventListener('sessionstart', () => {
    active = true;
    saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), target: controls.target.clone(), fov: camera.fov };
    hooks.onEnter?.();
    engine.cancelFly();
    engine.state.orbit = false;
    controls.enabled = false;
    // keep the headset frame rate up: no real-time shadows in VR
    if (workshop.lights?.key) workshop.lights.key.castShadow = false;
    // and fewer lights: every light is paid for by every pixel, twice
    vrOffLights = [];
    scene.traverse((o) => { if (o.isLight && o.userData.vrOff && o.visible) { o.visible = false; vrOffLights.push(o); } });
    rig.position.copy(ENTRANCE);
    rig.rotation.set(0, Math.atan2(ENTRANCE.x, ENTRANCE.z), 0);
    // the headset pose isn't known until the first frame; open the guide just after
    setTimeout(() => { ui.open('help'); placePanel(true); }, 400);
  });

  renderer.xr.addEventListener('sessionend', () => {
    for (const p of pointers) if (p.held) { scene.remove(p.held.holder); p.held = null; }
    physics?.clear();
    finishHeld();
    label.visible = false;
    active = false;
    panel.hide();
    for (const p of pointers) p.ring.visible = p.dot.visible = false;
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    camera.position.copy(saved.pos);
    camera.quaternion.copy(saved.quat);
    camera.fov = saved.fov;
    camera.updateProjectionMatrix();
    controls.target.copy(saved.target);
    controls.enabled = true;
    engine.state.orbit = true;
    if (workshop.lights?.key) workshop.lights.key.castShadow = true;
    for (const l of vrOffLights) l.visible = true;
    vrOffLights = [];
    hooks.onExit?.();
  });

  async function enter() {
    if (renderer.xr.isPresenting) { renderer.xr.getSession().end(); return; }
    renderer.xr.setReferenceSpaceType('local-floor');
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(session);
  }

  return {
    enter,
    get active() { return active; },
    refresh: () => ui.refresh(),
    showResult: (a) => { ui.showResult(a); placePanel(); },
    // exposed for automated checks without a headset
    _test: { ui, panel, interact, teleport, turn, placePanel, setActive(v) { active = v; }, pointers, tryGrab, release, label, get physics() { return physics; } },
  };
}
