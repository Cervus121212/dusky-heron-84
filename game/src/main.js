// COSTA LUNA — boot + game loop + the window.__game contract.
// Boots the renderer, builds every system, and runs one fixed update order:
// player -> cars (drive + traffic + sedan) -> sync player to car ->
// pedestrians -> police -> combat -> missions -> radio -> camera -> HUD.
// Query params: ?autopilot=1 runs the 58-check self test, ?shot=cover|chase|
// mission|title stages a screenshot, ?seed=N fixes the world, ?lowfx=1 trims
// effects. Everything runs fully offline — no network requests at all.

import * as THREE from 'three';
import { buildCity } from './city.js';
import { buildCars } from './cars.js';
import { buildPlayer } from './player.js';
import { buildPolice } from './police.js';
import { buildCombat } from './combat.js';
import { buildMissions } from './missions.js';
import { buildPedestrians } from './pedestrians.js';
import { buildAudio } from './audio.js';
import { buildHud } from './hud.js';
import { buildCamera } from './camera.js';
import { buildInput } from './input.js';
import { buildSave } from './save.js';
import { runAutopilot } from './selftest.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);

// --- Error + failed-request capture (read by the CDP driver) ---------------
window.__errors = [];
window.__failedReqs = [];
window.__fps = 0;
window.__autopilotResults = null;
window.addEventListener('error', (e) => {
  if (e.target === window || e.filename) {
    window.__errors.push(String(e.message || e.error || 'error'));
  }
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push('unhandled: ' + String(e.reason));
});
window.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t !== window && (t.src || t.href)) window.__failedReqs.push(t.src || t.href);
}, true);

// --- Renderer ----------------------------------------------------------------
// antialias OFF: in SwiftShader (software GL) MSAA at 1280x800 costs ~400 ms
// a frame for a 95-draw-call scene (measured 2.5 fps); without it the same
// scene runs an order of magnitude faster, and the screenshots stay clean.
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
if (params.has('lowfx')) {
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
}
renderer.domElement.className = 'webgl';
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(-60, 12, -180);

// --- Game state ---------------------------------------------------------------
const G = {
  THREE,
  seed: parseInt(params.get('seed') || '1', 10) || 1,
  scene,
  camera,
  renderer,
  keys: {},
  _prevKeys: {},
  time: 0,        // real seconds since boot (light-bar flash)
  elapsed: 0,     // game seconds since boot (daylight slide)
  timeScale: 1,
  clockMin: 18 * 60 + 53, // 18:53, golden hour
  cash: 0,
  rep: 0,
  state: 'title',
  shotMode: false,
  frames: 0,
  trace: [],
};

// Build order matters: town first (collision), then actors, then systems.
G.town = buildCity(G);
G.cars = buildCars(G);
G.player = buildPlayer(G);
G.police = buildPolice(G);
G.combat = buildCombat(G);
G.missions = buildMissions(G);
G.pedestrians = buildPedestrians(G);
G.sound = buildAudio(G);
G.hud = buildHud(G);
G.display = G.hud;
G.cam = buildCamera(G);
G.input = buildInput(G);
const save = buildSave(G);
G.saveGame = () => save.saveGame();
G.loadSave = () => save.loadSave();
G.hasSave = () => save.hasSave();
G.input.attach(renderer.domElement);

// --- Player-down + reset --------------------------------------------------------
G.onPlayerDown = () => {
  G.display.msg('Rico is down — back at the safehouse.', 5000);
  if (G.player.inCar) G.player.exitCar();
  G.player.setPlayer(-60, -168);
  G.player.health = 100;
  G.player.armour = 0;
  if (G.missions.active) G.missions.fail('Rico went down.');
  G.police.setStars(Math.min(G.police.stars + 1, 5));
};

G.resetRun = () => {
  G.cash = 0;
  G.rep = 0;
  G.clockMin = 18 * 60 + 53;
  G.elapsed = 0;
  G.timeScale = 1;
  G.trace.length = 0;
  G.missions.index = 0;
  G.missions.active = false;
  G.missions.step = 1;
  G.missions.stepT = 0;
  G.missions.completed = new Set();
  G.missions.chaseTarget = null;
  G.police.setStars(0);
  G.combat.clearEnemies();
  G.combat.weaponIndex = 0;
  G.combat.ammo = 120;
  G.combat.cooldown = 0;
  if (G.player.inCar) G.player.exitCar();
  G.player.setPlayer(-60, -150);
  G.player.heading = Math.PI / 2;
  G.player.health = 100;
  G.player.armour = 0;
  G.player.syncMesh();
  const s = G.cars.sedan;
  s.orbit.hp = 120;
  s.orbit.angle = 0;
  G.cam.yaw = Math.PI / 2;
  G.cam.lastDragT = 10;
  G.hud.refresh();
};

G.startGame = () => {
  if (G.state === 'playing') return;
  G.state = 'playing';
  document.getElementById('start').style.display = 'none';
  G.sound.resume();
  G.hud.refresh();
};

document.getElementById('startBtn').addEventListener('click', () => G.startGame());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- The __game contract (25 keys) --------------------------------------------
window.__game = {
  get time() { return G.clockMin; },
  get cash() { return G.cash; },
  get save() { return G.hasSave(); },
  get state() { return G.state; },
  player: G.player,
  setPlayer: (x, z) => G.player.setPlayer(x, z),
  exitCar: () => G.player.exitCar(),
  tryEnterCarAt: (x, z) => G.player.tryEnterCarAt(x, z),
  resetRun: () => G.resetRun(),
  saveGame: () => G.saveGame(),
  loadSave: () => G.loadSave(),
  display: G.display,
  missions: G.missions,
  police: G.police,
  combat: G.combat,
  cam: G.cam,
  town: G.town,
  scene: G.scene,
  renderer: G.renderer,
  sound: G.sound,
  traffic: G.cars.traffic,
  pedestrians: G.pedestrians,
  get timeScale() { return G.timeScale; },
  set timeScale(v) { G.timeScale = v; },
  get sirenActive() { return G.police.sirenActive; },
  version: 'costa-luna-1.0.0',
};
window.__trace = G.trace;

// --- Main loop ------------------------------------------------------------------
// Fixed-timestep game logic: the world advances in 1/30 s substeps driven by
// REAL elapsed time, so game time tracks real time at any frame rate — a slow
// software renderer must never starve the physics, the wanted decay, the
// weapon cooldowns or the mission timers (that is what killed the first
// autopilot run: 2.5 fps + a 0.05 s dt clamp = game time at ~10% speed).
// Camera + HUD refresh once per rendered frame, not per substep.
const STEP = 1 / 30;
let acc = 0;
let lastT = performance.now();
let fpsFrames = 0, fpsT = 0;

function update(dt) {
  G.elapsed += dt;
  G.clockMin += dt * 0.25; // 0.25 game-minutes per game-second
  G.town.updateDay(G.elapsed);
  G.player.update(dt);
  G.cars.update(dt);
  // The player rides the car: keep player pos/heading on the car every step.
  if (G.player.inCar && G.player.car) {
    G.player.x = G.player.car.x;
    G.player.z = G.player.car.z;
    G.player.heading = G.player.car.heading;
  }
  G.pedestrians.update(dt);
  G.police.update(dt);
  G.combat.update(dt);
  G.missions.update(dt);
  G.sound.beat(dt);

  // Edge-triggered keys.
  if (G.input.pressed('KeyE')) G.player.interact();
  if (G.input.pressed('Enter') && !G.missions.active) G.missions.start(G.missions.index);
  if (G.input.pressed('KeyR')) G.sound.nextStation();
  if (G.input.pressed('KeyM')) G.sound.toggleMute();
  if (G.input.pressed('Digit1')) G.combat.switchWeapon(0);
  if (G.input.pressed('Digit2')) G.combat.switchWeapon(1);
  if (G.input.pressed('Escape')) {
    G.state = 'paused';
    document.getElementById('pause').style.display = 'flex';
  }
  if (G.input.takeClick()) {
    G.sound.resume();
    if (!G.player.inCar) G.combat.shoot();
  }
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const rawDt = (now - lastT) / 1000;
  lastT = now;
  G.time += rawDt;

  if (G.state === 'playing' && !G.shotMode) {
    acc += Math.min(rawDt, 0.5);
    let n = 0;
    while (acc >= STEP && n < 30) {
      update(STEP * G.timeScale);
      acc -= STEP;
      n++;
    }
    if (n === 30) acc = 0; // drop backlog: never spiral on a stalled frame
    // Camera + HUD once per rendered frame.
    G.cam.update(Math.min(rawDt, 0.1) * G.timeScale);
    G.hud.refresh();
  } else if (G.state === 'paused') {
    if (G.input.pressed('Escape')) {
      G.state = 'playing';
      document.getElementById('pause').style.display = 'none';
    }
  }

  renderer.render(scene, camera);
  G.frames++;
  fpsFrames++;
  fpsT += rawDt;
  if (fpsT >= 1) {
    window.__fps = Math.round(fpsFrames / fpsT);
    const fpsEl = document.getElementById('fps');
    if (fpsEl) fpsEl.textContent = window.__fps + ' fps';
    fpsFrames = 0;
    fpsT = 0;
  }
}
frame();
G.hud.refresh();

// --- Query modes ------------------------------------------------------------------
if (params.get('autopilot') === '1') {
  setTimeout(() => { runAutopilot(G).catch((e) => { window.__errors.push('autopilot: ' + e.message); document.title = 'AUTOPILOT-FAIL'; }); }, 500);
} else if (params.get('shot')) {
  setTimeout(() => { stageShot(G, params.get('shot')); }, 500);
}
