// Luna PD dispatch for COSTA LUNA: wanted stars 1-5, cruisers, foot cops,
// Air One helicopter (3+ stars), roadblocks (4+ stars), and wanted decay.
// Decay counts distance to cruisers and foot cops only — the helicopter never
// counts, or the heat would never cool off.

import * as THREE from 'three';
import { clamp, dist2, mulberry32 } from './util.js';
import { makeCarMesh } from './cars.js';

function makeCopMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a078, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), navy);
  body.position.y = 1.25; body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.05; group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.7 }));
  cap.position.y = 2.32; group.add(cap);
  for (const lx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.32), navy);
    leg.position.set(lx, 0.38, 0); group.add(leg);
  }
  return group;
}

function makeHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6), bodyMat);
  body.castShadow = true; group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
  tail.position.set(0, 0.3, -5); group.add(tail);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 }));
  glass.position.set(0, 0.3, 2.6); group.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
  rotor.position.y = 1.1; group.add(rotor);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  for (const sx of [-1.2, 1.2]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.5), skidMat);
    skid.position.set(sx, -1.1, 0); group.add(skid);
  }
  group.userData.rotor = rotor;
  return group;
}

function makeRoadblockMesh() {
  const group = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#f2f2f2' : '#ff5a2a';
    x.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 0.4),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  bar.position.y = 1.1; bar.castShadow = true;
  group.add(bar);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.8 });
  for (const cx of [-3.4, 3.4]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), coneMat);
    cone.position.set(cx, 0.55, 0); group.add(cone);
  }
  return group;
}

export function buildPolice(G) {
  const rng = mulberry32(G.seed + 21);
  const police = {
    stars: 0,
    cars: [],   // cruisers
    cops: [],   // foot cops
    heli: null,
    roadblocks: [],
    nearestDist: 9999,
    decayT: 0,
    sirenActive: false,

    cruiserCountFor(stars) { return stars >= 1 ? Math.min(2 + stars, 7) : 0; },
    copCountFor(stars) { return stars >= 2 ? Math.min(stars, 4) : 0; },

    setStars(n) {
      n = clamp(Math.round(n), 0, 5);
      const prev = this.stars;
      this.stars = n;
      this.sirenActive = n > 0;
      // Cruisers.
      const wantCars = this.cruiserCountFor(n);
      while (this.cars.length < wantCars) this.cars.push(this.spawnCruiser());
      while (this.cars.length > wantCars) {
        const c = this.cars.pop();
        G.scene.remove(c.group);
      }
      // Foot cops.
      const wantCops = this.copCountFor(n);
      while (this.cops.length < wantCops) this.cops.push(this.spawnCop());
      while (this.cops.length > wantCops) {
        const c = this.cops.pop();
        G.scene.remove(c.mesh);
      }
      // Helicopter at 3+ stars.
      if (n >= 3 && !this.heli) {
        const group = makeHeliMesh();
        G.scene.add(group);
        this.heli = { group, angle: 2.2, x: 0, z: 0 };
      } else if (n < 3 && this.heli) {
        G.scene.remove(this.heli.group);
        this.heli = null;
      }
      // Roadblocks at 4+ stars.
      if (n >= 4 && this.roadblocks.length === 0) {
        for (let i = 0; i < 2; i++) {
          const rb = makeRoadblockMesh();
          const px = G.player.x, pz = G.player.z;
          const a = G.player.heading + (i === 0 ? 0.5 : -0.4);
          const d = 45 + i * 30;
          const bx = clamp(px + Math.sin(a) * d, -280, 280);
          const bz = clamp(pz + Math.cos(a) * d, -280, 280);
          rb.position.set(bx, 0, bz);
          rb.rotation.y = a + Math.PI / 2;
          G.scene.add(rb);
          this.roadblocks.push(rb);
        }
      } else if (n < 4 && this.roadblocks.length > 0) {
        for (const rb of this.roadblocks) G.scene.remove(rb);
        this.roadblocks = [];
      }
      if (n !== prev) this.decayT = 0;
      G.hud.refresh();
    },

    spawnCruiser() {
      // Spawn on a road 120-180 m from the player.
      const a = rng() * Math.PI * 2;
      const d = 120 + rng() * 60;
      let x = clamp(G.player.x + Math.sin(a) * d, -280, 280);
      let z = clamp(G.player.z + Math.cos(a) * d, -280, 280);
      x = Math.round(x / 64) * 64;
      z = Math.round(z / 64) * 64;
      const group = makeCarMesh(0xf2f2f2, { police: true });
      G.scene.add(group);
      return { group, x, z, heading: Math.atan2(G.player.x - x, G.player.z - z), speed: 0 };
    },

    spawnCop() {
      const a = rng() * Math.PI * 2;
      const d = 20 + rng() * 30;
      const mesh = makeCopMesh();
      const x = clamp(G.player.x + Math.sin(a) * d, -280, 280);
      const z = clamp(G.player.z + Math.cos(a) * d, -280, 280);
      mesh.position.set(x, 0, z);
      G.scene.add(mesh);
      return { mesh, x, z, hitT: 0 };
    },

    update(dt) {
      const p = G.player;
      // Cruisers chase the player (max 38 m/s, slower than the player's 42).
      for (const c of this.cars) {
        const want = Math.atan2(p.x - c.x, p.z - c.z);
        let dh = want - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
        c.speed = Math.min(c.speed + 12 * dt, 38);
        let nx = c.x + Math.sin(c.heading) * c.speed * dt;
        let nz = c.z + Math.cos(c.heading) * c.speed * dt;
        const hit = G.town.collideCircle(nx, nz, 1.7);
        if (hit.hit) {
          // Blocked by a building: swerve to unstick instead of grinding.
          c.heading += 0.7;
          nx = c.x; nz = c.z;
        }
        c.x = clamp(nx, -300, 300);
        c.z = clamp(nz, -300, 300);
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
        // Light bar flash (alternating red/blue).
        const bar = c.group.userData.lightBar;
        if (bar) {
          const on = Math.floor(G.time * 6) % 2 === 0;
          bar.red.material.emissiveIntensity = on ? 3 : 0.4;
          bar.blue.material.emissiveIntensity = on ? 0.4 : 3;
        }
      }
      // Foot cops run at the player; contact deals 2 damage per second.
      for (const c of this.cops) {
        const d = dist2(c.x, c.z, p.x, p.z);
        const h = Math.atan2(p.x - c.x, p.z - c.z);
        c.x += Math.sin(h) * 7 * dt;
        c.z += Math.cos(h) * 7 * dt;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = h;
        c.hitT -= dt;
        if (d < 2 && c.hitT <= 0 && !p.inCar) {
          p.damage(2);
          c.hitT = 1;
        }
      }
      // Air One orbits the player, dt-driven 0.35 rad/s, altitude 22 m.
      if (this.heli) {
        this.heli.angle += 0.35 * dt;
        const hx = p.x + Math.cos(this.heli.angle) * 40;
        const hz = p.z + Math.sin(this.heli.angle) * 40;
        this.heli.group.position.set(hx, 22, hz);
        this.heli.group.rotation.y = Math.atan2(p.x - hx, p.z - hz);
        this.heli.group.userData.rotor.rotation.y += dt * 22;
        this.heli.x = hx; this.heli.z = hz;
      }
      // Nearest police distance (cruisers + cops only; the heli never counts).
      let nearest = 9999;
      for (const c of this.cars) nearest = Math.min(nearest, dist2(c.x, c.z, p.x, p.z));
      for (const c of this.cops) nearest = Math.min(nearest, dist2(c.x, c.z, p.x, p.z));
      this.nearestDist = nearest;
      // Wanted decay: only when far from every cruiser and cop.
      if (this.stars > 0) {
        if (nearest > 150) {
          this.decayT += dt;
          if (this.decayT >= 4) {
            this.decayT = 0;
            this.setStars(this.stars - 1);
            G.display.msg('Heat cooling off… ' + this.stars + '★');
          }
        } else {
          this.decayT = 0;
        }
      }
      // Siren volume follows the nearest unit.
      G.sound.siren(this.nearestDist, this.stars > 0);
    },
  };
  return police;
}
