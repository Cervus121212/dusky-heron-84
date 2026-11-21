// Chase camera for COSTA LUNA.
// yaw is the VIEW direction (also the aim direction). While driving and idle
// for more than 1.5 s it eases onto the heading (2.2/s, 1.4/s when close);
// on foot it never auto-eases, so a staged aim stays exactly where it was.
// Distance 11 + speed*0.06, FOV 62 -> 70 with speed.

import { clamp, angleDiff, angleEase } from './util.js';

export function buildCamera(G) {
  const cam = {
    yaw: Math.PI / 2,
    pitch: 0.32,
    yawError: 0, // degrees between view yaw and heading
    distance: 11,
    zoom: 0,
    lastDragT: 10, // starts idle so the camera settles behind the car at once
    fov: 62,

    update(dt) {
      if (G.shotMode) return; // staged shots freeze the camera
      const drag = G.input.takeDrag();
      if (drag.x !== 0 || drag.y !== 0) {
        this.yaw -= drag.x * 0.005;
        this.pitch = clamp(this.pitch + drag.y * 0.003, 0.08, 1.1);
        this.lastDragT = 0;
      } else {
        this.lastDragT += dt;
      }
      const p = G.player;
      const speed = p.inCar && p.car ? Math.abs(p.car.speed) : 0;
      // Auto-ease onto the heading only while driving and idle.
      if (p.inCar && this.lastDragT > 1.5) {
        const err = Math.abs(angleDiff(this.yaw, p.heading));
        const rate = err < 0.3 ? 1.4 : 2.2;
        this.yaw = angleEase(this.yaw, p.heading, rate, dt);
      }
      this.yawError = Math.abs(angleDiff(this.yaw, p.heading)) * 180 / Math.PI;
      this.distance = 11 + speed * 0.06 + this.zoom;
      this.fov = 62 + speed * 0.19;
      const target = { x: p.x, y: 1.6, z: p.z };
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const height = 4.2 + Math.sin(this.pitch) * 6;
      const cx = target.x - fx * this.distance;
      const cz = target.z - fz * this.distance;
      G.camera.position.set(cx, target.y + height, cz);
      G.camera.lookAt(target.x + fx * 4, target.y + 0.6, target.z + fz * 4);
      if (Math.abs(G.camera.fov - this.fov) > 0.05) {
        G.camera.fov = this.fov;
        G.camera.updateProjectionMatrix();
      }
    },

    // Direct staging for screenshots (shot mode): place the camera exactly.
    stage(pos, look) {
      G.camera.position.set(pos[0], pos[1], pos[2]);
      G.camera.lookAt(look[0], look[1], look[2]);
      G.camera.fov = 62;
      G.camera.updateProjectionMatrix();
    },
  };
  return cam;
}
