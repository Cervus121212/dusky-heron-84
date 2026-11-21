// Cars for COSTA LUNA: the player's driveable cars, the garage sedan, the
// mission van and sedan, and 14 traffic cars that follow the road grid.
// Driving: accel 16, brake 30, reverse 9, max 42 m/s, steer 1.9 rad/s, drag 0.35.
// Traffic anti-jam: turn after 3 s stuck, respawn after 6 s.

import * as THREE from 'three';
import { clamp, mulberry32 } from './util.js';

export const DRIVE = { accel: 16, brake: 30, reverse: 9, maxSpeed: 42, maxReverse: 14, steer: 1.9, drag: 0.35 };

const TRAFFIC_COLORS = [0xc0c0c0, 0x8a2a2a, 0x2a4a8a, 0xc9a227, 0x3a3a3a, 0x7a5a9a, 0xe0e0e0, 0x2a8a4a];

export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.62; body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.25, -0.2); cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    group.add(w); wheels.push(w);
  }
  // Headlights + taillights (emissive so they read in dusk shots).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6 });
  for (const hx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headMat);
    h.position.set(hx, 0.65, 2.22); group.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xaa1010, emissiveIntensity: 1.2 });
  for (const hx of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    t.position.set(hx, 0.65, -2.22); group.add(t);
  }
  if (opts.police) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.5), barMat);
    bar.position.set(0, 1.68, -0.2); group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.5 }));
    red.position.set(-0.4, 1.68, -0.2); group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2.5 }));
    blue.position.set(0.4, 1.68, -0.2); group.add(blue);
    group.userData.lightBar = { red, blue };
  }
  group.userData.wheels = wheels;
  return group;
}

export function buildCars(G) {
  const rng = mulberry32(G.seed + 7);
  const cars = {
    list: [],
    traffic: [],
    garageCar: null,
    van: null,
    sedan: null, // M6 green sedan (the ram target)
  };

  function addCar(name, color, x, z, heading, opts = {}) {
    const group = makeCarMesh(color, opts);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    G.scene.add(group);
    const car = { name, group, x, z, heading, speed: 0, color, ...opts };
    cars.list.push(car);
    return car;
  }

  // The player's own sedan (starts parked by the safehouse garage).
  cars.garageCar = addCar('garage-sedan', 0x2a6fd4, -120, 24, Math.PI / 2);
  // M7 van at the beach.
  cars.van = addCar('beach-van', 0xe8e0c8, -180, 232, Math.PI);
  // M6 green sedan (drives an ellipse around (40, 80)).
  cars.sedan = addCar('green-sedan', 0x2a8a3a, 110, 80, 0);
  cars.sedan.orbit = { cx: 40, cz: 80, rx: 70, rz: 55, angle: 0, speed: 0.12, hp: 120, maxHp: 120 };
  // A spare coupe near the safehouse so the player always has a ride.
  addCar('street-coupe', 0xc22a5a, -84, -150, Math.PI / 2);

  // --- Traffic: 14 cars on the road grid --------------------------------
  const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
  for (let i = 0; i < 14; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = ROADS[Math.floor(rng() * ROADS.length)];
    const along = -256 + rng() * 512;
    const color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
    const group = makeCarMesh(color);
    G.scene.add(group);
    const t = {
      name: 'traffic-' + i, group, axis, line, along,
      dir: rng() < 0.5 ? 1 : -1,
      speed: 8 + rng() * 6,
      stuckT: 0, lastAlong: along, color, isTraffic: true,
    };
    cars.traffic.push(t);
    cars.list.push(t);
  }

  cars.syncMesh = (car) => {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    const spin = car.speed * 0.016 / 0.42;
    for (const w of car.group.userData.wheels) w.rotation.x += spin;
  };

  // Drive the player's car with the arcade model. Called only when the
  // player is in a car; `car` is always the car the player is actually using.
  cars.drivePlayer = (car, dt) => {
    const k = G.keys;
    const fwd = (k.KeyW || k.ArrowUp) ? 1 : 0;
    const back = (k.KeyS || k.ArrowDown) ? 1 : 0;
    const steerL = (k.KeyA || k.ArrowLeft) ? 1 : 0;
    const steerR = (k.KeyD || k.ArrowRight) ? 1 : 0;
    if (fwd) car.speed += DRIVE.accel * dt;
    if (back) {
      if (car.speed > 0.5) car.speed -= DRIVE.brake * dt;
      else car.speed -= DRIVE.reverse * dt;
    }
    // Drag always bleeds speed.
    car.speed -= car.speed * DRIVE.drag * dt;
    car.speed = clamp(car.speed, -DRIVE.maxReverse, DRIVE.maxSpeed);
    if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
    // Steering scales with speed so a parked car cannot spin in place.
    const steerIn = steerR - steerL;
    const grip = clamp(Math.abs(car.speed) / 8, 0, 1);
    car.heading += steerIn * DRIVE.steer * dt * grip * (car.speed < 0 ? -1 : 1);
    // Move with per-axis collision so the car slides along walls.
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let nx = car.x + fx * car.speed * dt;
    let nz = car.z + fz * car.speed * dt;
    const cx = G.town.collideCircle(nx, car.z, 1.7);
    nx = cx.x;
    const cz = G.town.collideCircle(nx, nz, 1.7);
    nz = cz.z;
    car.x = clamp(nx, -300, 300);
    car.z = clamp(nz, -300, 300);
    cars.syncMesh(car);
  };

  cars.updateTraffic = (dt) => {
    for (const t of cars.traffic) {
      // Brake for the player's car ahead.
      let blocked = false;
      if (G.player.inCar && G.player.car) {
        const p = G.player.car;
        const dx = p.x - t.group.position.x, dz = p.z - t.group.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 7) {
          const fx = Math.sin(t.heading || 0), fz = Math.cos(t.heading || 0);
          if (dx * fx + dz * fz > 0) blocked = true;
        }
      }
      const v = blocked ? 0 : t.speed;
      const prev = t.along;
      t.along += t.dir * v * dt;
      // Turn at intersections: when crossing a 64 m grid line, sometimes turn.
      const crossed = Math.floor(t.along / 64) !== Math.floor(prev / 64);
      if (crossed && rng() < 0.3) {
        const newLine = Math.round(t.along / 64) * 64;
        const oldLine = t.line;
        t.line = newLine;
        t.along = oldLine;
        t.axis = t.axis === 'x' ? 'z' : 'x';
        t.dir = rng() < 0.5 ? 1 : -1;
      }
      if (t.along > 284 || t.along < -284) {
        // Wrap to a fresh road instead of mirroring back.
        t.axis = rng() < 0.5 ? 'x' : 'z';
        t.line = ROADS[Math.floor(rng() * ROADS.length)];
        t.along = -t.dir * 280;
        t.dir = t.dir;
      }
      // Anti-jam: 3 s stuck -> turn, 6 s stuck -> respawn on a new road.
      if (Math.abs(t.along - t.lastAlong) < 0.05) t.stuckT += dt;
      else t.stuckT = 0;
      t.lastAlong = t.along;
      if (t.stuckT > 6) {
        t.axis = rng() < 0.5 ? 'x' : 'z';
        t.line = ROADS[Math.floor(rng() * ROADS.length)];
        t.along = -256 + rng() * 512;
        t.dir = rng() < 0.5 ? 1 : -1;
        t.stuckT = 0;
      } else if (t.stuckT > 3) {
        t.dir *= -1;
        t.stuckT = 1;
      }
      if (t.axis === 'x') {
        t.x = t.along; t.z = t.line;
        t.heading = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        t.x = t.line; t.z = t.along;
        t.heading = t.dir > 0 ? 0 : Math.PI;
      }
      t.group.position.set(t.x, 0, t.z);
      t.group.rotation.y = t.heading;
      const spin = v * dt / 0.42;
      for (const w of t.group.userData.wheels) w.rotation.x += spin;
    }
  };

  // M6 sedan: drives an ellipse around (40, 80); ramming it damages it.
  cars.updateSedan = (dt) => {
    const s = cars.sedan;
    if (!s || s.orbit.hp <= 0) return;
    s.orbit.angle += s.orbit.speed * dt;
    const a = s.orbit.angle;
    s.x = s.orbit.cx + Math.cos(a) * s.orbit.rx;
    s.z = s.orbit.cz + Math.sin(a) * s.orbit.rz;
    // Heading tangent to the ellipse.
    const dx = -Math.sin(a) * s.orbit.rx, dz = Math.cos(a) * s.orbit.rz;
    s.heading = Math.atan2(dx, dz);
    s.group.position.set(s.x, 0, s.z);
    s.group.rotation.y = s.heading;
  };

  cars.update = (dt) => {
    if (G.player.inCar && G.player.car) cars.drivePlayer(G.player.car, dt);
    cars.updateTraffic(dt);
    cars.updateSedan(dt);
  };

  return cars;
}
