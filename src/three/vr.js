import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { ROOM } from './room.js';
import { makeBlocker } from './walk.js';
import { createPanel } from './vrPanel.js';
import { createVRUI } from '../ui/vrViews.js';

const MOVE_SPEED = 2;
const SNAP = Math.PI / 6; // 30°
const REACH = 8;
const ENTRANCE = new THREE.Vector3(2.4, 0, 7.4);
const BENCH_SPOT = new THREE.Vector3(0.1, 0, 1.15);

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
    const p = { ctrl, grip, line, lineMat, ring, dot, source: null, hit: null, scan: 0, lastScan: null, turnReady: true };
    ctrl.addEventListener('connected', (e) => { p.source = e.data; line.visible = e.data.targetRayMode !== 'gaze'; });
    ctrl.addEventListener('disconnected', () => { p.source = null; });
    ctrl.addEventListener('selectstart', () => select(p));
    ctrl.addEventListener('squeezestart', () => toggleMenu());
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

  const sceneTargets = () => scene.children.filter((c) => c !== rig && c !== panel.group && !c.isLight && c.visible);

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
    let hover = null;
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
          p.lastScan = h ? { target: findInteract(h.object), point: h.point.clone(), distance: h.distance } : null;
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

      // thumbsticks: left walks, right snap-turns
      const gp = p.source.gamepad;
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
  });

  // --- session lifecycle --------------------------------------------------------------
  renderer.xr.addEventListener('sessionstart', () => {
    active = true;
    saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), target: controls.target.clone(), fov: camera.fov };
    hooks.onEnter?.();
    engine.cancelFly();
    engine.state.orbit = false;
    controls.enabled = false;
    // keep the headset frame rate up: no real-time shadows in VR
    if (workshop.lights?.key) workshop.lights.key.castShadow = false;
    rig.position.copy(ENTRANCE);
    rig.rotation.set(0, Math.atan2(ENTRANCE.x, ENTRANCE.z), 0);
    // the headset pose isn't known until the first frame; open the guide just after
    setTimeout(() => { ui.open('help'); placePanel(true); }, 400);
  });

  renderer.xr.addEventListener('sessionend', () => {
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
    hooks.onExit?.();
  });

  async function enter() {
    if (renderer.xr.isPresenting) { renderer.xr.getSession().end(); return; }
    renderer.xr.setReferenceSpaceType('local-floor');
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
  }

  return {
    enter,
    get active() { return active; },
    refresh: () => ui.refresh(),
    showResult: (a) => { ui.showResult(a); placePanel(); },
    // exposed for automated checks without a headset
    _test: { ui, panel, interact, teleport, turn, placePanel, setActive(v) { active = v; }, pointers },
  };
}
