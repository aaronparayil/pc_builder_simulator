import * as THREE from 'three';

// Just enough rigid-body physics for parts you throw in VR: gravity, bounces off the
// floor, walls and furniture (axis-aligned boxes), friction, and toppling to lie flat.
// Bodies don't collide with each other.

const GRAVITY = 9.81;
const RESTITUTION = 0.32;
const FRICTION = 0.55; // share of sliding speed lost per contact step
const MAX_BODIES = 14;
const FLAT = 1.25; // a part can rest at up to this many times its thinnest height
const TOPPLE = 45; // rad/s² a part tips over with
const TIP_MEMORY = 0.25; // seconds a part keeps tipping after losing contact

const corners = [...Array(8)].map(() => new THREE.Vector3());
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const AXES = ['x', 'y', 'z'].flatMap((name) => [1, -1].map((sign) => ({ name, dir: new THREE.Vector3(name === 'x' ? sign : 0, name === 'y' ? sign : 0, name === 'z' ? sign : 0) })));

/**
 * `solids`: world-space THREE.Box3 list; `room`: { minX, maxX, minZ, maxZ, H }.
 * `onImpact(body, speed)` fires on hard hits (for a sound).
 */
export function createPhysics({ solids, room, onImpact }) {
  const bodies = [];

  /** Start simulating `object` (origin at its centre) with local half extents `half`. */
  function add(object, half, velocity, spin) {
    // the faces it can lie on: thin parts only their broad sides, chunky ones most sides
    const thin = Math.min(half.x, half.y, half.z);
    const rests = AXES.filter((a) => half[a.name] <= thin * FLAT).map((a) => a.dir);
    const body = { object, half: half.clone(), rests, vel: velocity.clone(), spin: spin.clone(), still: 0, asleep: false, lastHit: 0, tip: 0, tipUntil: 0 };
    bodies.push(body);
    while (bodies.length > MAX_BODIES) {
      const old = bodies.shift();
      old.object.parent?.remove(old.object);
    }
    return body;
  }

  function remove(object) {
    const i = bodies.findIndex((b) => b.object === object);
    if (i >= 0) bodies.splice(i, 1);
  }

  function clear() {
    for (const b of bodies) b.object.parent?.remove(b.object);
    bodies.length = 0;
  }

  function worldBox(body, box) {
    const { object, half } = body;
    object.updateMatrix();
    let i = 0;
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      corners[i++].set(x * half.x, y * half.y, z * half.z).applyMatrix4(object.matrix);
    }
    return box.setFromPoints(corners);
  }

  const box = new THREE.Box3();
  const normal = new THREE.Vector3();

  /** Push the body out along `n` by `depth` and bounce/slide its velocity. */
  function contact(body, n, depth, time) {
    body.object.position.addScaledVector(n, depth);
    const vn = body.vel.dot(n);
    if (vn < 0) {
      if (-vn > 0.7 && time - body.lastHit > 0.12) { onImpact?.(body, -vn); body.lastHit = time; }
      body.vel.addScaledVector(n, -(1 + RESTITUTION) * vn);
      if (-vn < 0.35) body.vel.addScaledVector(n, -body.vel.dot(n)); // no endless micro-bounces
      tmpV.copy(body.vel).addScaledVector(n, -body.vel.dot(n));
      body.vel.addScaledVector(tmpV, -FRICTION);
      body.spin.multiplyScalar(0.7);
    }
    return n.y > 0.7;
  }

  /** Tip towards the nearest stable face, slowly at first like something falling over. */
  function settle(body, dt) {
    const q = body.object.quaternion;
    let best = null, bestDot = -2;
    for (const a of body.rests) {
      const d = tmpV.copy(a).applyQuaternion(q).y;
      if (d > bestDot) { bestDot = d; best = a; }
    }
    const angle = Math.acos(Math.min(1, bestDot));
    if (angle < 1e-4) { body.tip = 0; return true; }
    body.tip = Math.min(body.tip + TOPPLE * dt, 14 * angle + 0.3);
    tmpV.copy(best).applyQuaternion(q);
    tmpQ.setFromUnitVectors(tmpV, UP).multiply(q);
    q.rotateTowards(tmpQ, body.tip * dt);
    return angle - body.tip * dt < 0.02;
  }

  function stepBody(body, dt, time) {
    const o = body.object;
    body.vel.y -= GRAVITY * dt;
    o.position.addScaledVector(body.vel, dt);
    const w = body.spin.length();
    if (w > 1e-4) {
      tmpQ.setFromAxisAngle(tmpV.copy(body.spin).divideScalar(w), w * dt);
      o.quaternion.premultiply(tmpQ);
    }
    let grounded = false;
    worldBox(body, box);
    // floor, ceiling and walls
    if (box.min.y < 0) grounded = contact(body, normal.set(0, 1, 0), -box.min.y, time) || grounded;
    if (box.max.y > room.H) contact(body, normal.set(0, -1, 0), box.max.y - room.H, time);
    if (box.min.x < room.minX) contact(body, normal.set(1, 0, 0), room.minX - box.min.x, time);
    if (box.max.x > room.maxX) contact(body, normal.set(-1, 0, 0), box.max.x - room.maxX, time);
    if (box.min.z < room.minZ) contact(body, normal.set(0, 0, 1), room.minZ - box.min.z, time);
    if (box.max.z > room.maxZ) contact(body, normal.set(0, 0, -1), box.max.z - room.maxZ, time);
    // furniture: push out along the axis of least overlap
    for (const s of solids) {
      worldBox(body, box);
      if (!box.intersectsBox(s)) continue;
      const pens = [
        [s.max.y - box.min.y, 0, 1, 0], [box.max.y - s.min.y, 0, -1, 0],
        [s.max.x - box.min.x, 1, 0, 0], [box.max.x - s.min.x, -1, 0, 0],
        [s.max.z - box.min.z, 0, 0, 1], [box.max.z - s.min.z, 0, 0, -1],
      ];
      // landing on top wins when the body is coming down onto it
      let [depth, x, y, z] = pens.reduce((a, b) => (b[0] < a[0] ? b : a));
      if (pens[0][0] < 0.06 && body.vel.y <= 0.2) [depth, x, y, z] = pens[0];
      grounded = contact(body, normal.set(x, y, z), depth, time) || grounded;
    }
    let flat = false;
    if (grounded) {
      body.spin.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (body.vel.length() < 1.2) body.tipUntil = time + TIP_MEMORY;
    }
    // keep tipping through the short drops while it falls over
    if (time < body.tipUntil) flat = settle(body, dt);
    else body.tip = 0;
    const slow = body.vel.lengthSq() < 0.0025 && body.spin.lengthSq() < 0.05;
    body.still = grounded && slow && flat ? body.still + dt : 0;
    if (body.still > 0.4) { body.asleep = true; body.vel.set(0, 0, 0); body.spin.set(0, 0, 0); }
  }

  let time = 0;
  function step(dt) {
    dt = Math.min(dt, 1 / 30);
    time += dt;
    const sub = 3;
    for (const b of bodies) {
      if (b.asleep) continue;
      for (let i = 0; i < sub; i++) stepBody(b, dt / sub, time);
    }
  }

  return { add, remove, clear, step, bodies };
}
