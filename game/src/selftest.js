// Autopilot for COSTA LUNA: 58 deterministic checks that drive the real game
// through its public window.__game API — city, driving, camera, all 8 missions,
// police, combat, traffic, pedestrians, radio, save and performance.
// Runs only when the page loads with ?autopilot=1. Sets document.title to
// AUTOPILOT-PASS / AUTOPILOT-FAIL and fills #test-results + __autopilotResults.

import { dist2 } from './util.js';

export async function runAutopilot(G) {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitGame = async (sec) => { await sleep((sec * 1000) / G.timeScale); };
  // Poll until cond() is true or the real-time budget runs out. A fixed sleep
  // is NOT proof the game advanced: in software GL a frame can stall for
  // >600 ms, so mission completions and cooldowns must be awaited, not slept.
  const waitFor = async (cond, budgetMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < budgetMs) {
      if (cond()) return true;
      await sleep(150);
    }
    return cond();
  };
  const check = (name, pass, info) => {
    results.push({ name, pass: !!pass, info: String(info ?? '') });
  };
  const holdKey = async (code, gameSec) => {
    G.keys[code] = true;
    await waitGame(gameSec);
    G.keys[code] = false;
  };
  // Teleport the player — and the car too when driving.
  const tp = (x, z) => {
    if (G.player.inCar && G.player.car) {
      G.player.car.x = x; G.player.car.z = z; G.player.car.speed = 0;
      G.cars.syncMesh(G.player.car);
    }
    G.player.setPlayer(x, z);
  };
  const loseHeat = async () => {
    const corners = [[-280, -280], [280, -280], [-280, 280], [280, 280]];
    let guard = 0;
    G.timeScale = 3;
    while (G.police.stars > 0 && guard++ < 10) {
      const c = corners[guard % 4];
      tp(c[0], c[1]);
      await waitGame(4.5);
    }
    G.timeScale = 1;
  };

  G.resetRun();
  G.state = 'playing';
  document.getElementById('start').style.display = 'none';
  await sleep(500);

  // ---- API contract ------------------------------------------------------
  const keys = Object.keys(window.__game);
  check('api: __game has all contract keys', keys.length === 25, keys.length + ' keys');
  check('api: player shape', G.player.x === -60 && G.player.z === -150 && G.player.health === 100, 'x=' + G.player.x + ' z=' + G.player.z);
  check('api: missions shape', G.missions.completed instanceof Set, 'completed is Set: ' + (G.missions.completed instanceof Set));
  check('api: police shape', G.police.stars === 0, 'stars=' + G.police.stars);
  check('api: combat shape', G.combat.weapons.length === 2, 'weapons=' + G.combat.weapons.length);
  check('api: cam shape', Math.abs(G.cam.yaw - Math.PI / 2) < 0.01, 'yaw=' + G.cam.yaw.toFixed(2));
  check('api: world surfaces', G.cars.traffic.length === 14 && G.pedestrians.list.length === 12, 'traffic=' + G.cars.traffic.length + ' peds=' + G.pedestrians.list.length);
  check('api: no errors, no failed requests', window.__errors.length === 0 && window.__failedReqs.length === 0, 'errors=' + window.__errors.length);

  // ---- City ---------------------------------------------------------------
  check('city: ground spans +-288', G.town.groundHalf === 288 && G.town.buildings.length === 69, G.town.buildings.length + ' buildings');
  check('city: building count sane', G.town.buildings.length === 69, String(G.town.buildings.length));
  check('city: beach zone is sand (z=280)', G.town.districtAt(0, 280) === 'PALM BEACH', G.town.districtAt(0, 280));
  check('city: docks zone (x=250)', G.town.districtAt(250, 0) === 'THE DOCKS', G.town.districtAt(250, 0));
  check('city: sun disc at (-260,78,330)', G.town.sunPos.x === -260 && G.town.sunPos.y === 78 && G.town.sunPos.z === 330, 'sun=(' + G.town.sunPos.x + ',' + G.town.sunPos.y + ',' + G.town.sunPos.z + ')');
  check('city: yacht La Sirena at (60,232)', G.town.yachtPos.x === 60 && G.town.yachtPos.z === 232, 'yacht=(' + G.town.yachtPos.x + ',' + G.town.yachtPos.z + ')');

  // ---- Driving ------------------------------------------------------------
  check('drive: spawn (-60,-150) heading PI/2', G.player.x === -60 && G.player.z === -150 && Math.abs(G.player.heading - Math.PI / 2) < 0.01, '(' + G.player.x + ',' + G.player.z + ') h=' + G.player.heading.toFixed(2));
  tp(-120, 24);
  const entered = G.player.tryEnterCarAt(-120, 24);
  check('drive: enter car at garage', entered && G.player.inCar, entered ? 'in car' : 'failed');
  // Hold W until the car is past 5 m/s (polled: a fixed sleep is not proof
  // the game advanced when frames stall).
  G.keys.KeyW = true;
  const gotSpeed = await waitFor(() => G.player.car.speed > 5, 6000);
  G.keys.KeyW = false;
  const speedW = G.player.car.speed;
  check('drive: W accelerates past 5 m/s', gotSpeed, 'speed=' + speedW.toFixed(1));
  const v0 = G.player.car.speed;
  G.keys.KeyS = true;
  await waitFor(() => G.player.car.speed < 10, 4000);
  const v1 = G.player.car.speed;
  const gotReverse = await waitFor(() => G.player.car.speed < -10, 6000);
  G.keys.KeyS = false;
  const v2 = G.player.car.speed;
  check('drive: S brakes then reverses', gotReverse, v0.toFixed(1) + ' -> ' + v1.toFixed(1) + ' -> ' + v2.toFixed(1));
  G.keys.KeyW = true;
  const gotMax = await waitFor(() => G.player.car.speed >= 40, 12000);
  G.keys.KeyW = false;
  const vMax = G.player.car.speed;
  check('drive: max speed capped at 42', gotMax && vMax <= 42.01, 'speed=' + vMax.toFixed(1));
  const h0 = G.player.car.heading;
  G.keys.KeyA = true;
  const gotSteer = await waitFor(() => (G.player.car.heading - h0) < -1.5, 3000);
  G.keys.KeyA = false;
  const dh = G.player.car.heading - h0;
  check('drive: steering changes heading', gotSteer && dh > -2.3, 'dHeading=' + dh.toFixed(2));
  // Building collision: drive east into the building at (-235,-235).
  tp(-280, -235);
  G.player.car.heading = Math.PI / 2;
  await holdKey('KeyW', 3);
  const cx = G.player.car.x;
  check('drive: building collision blocks the car, position clamped +-300', cx < -240 && cx > -260 && Math.abs(cx) <= 300, 'car=(' + cx.toFixed(1) + ',' + G.player.car.z.toFixed(1) + ') box x -245..-225');
  tp(295, 0);
  G.player.car.heading = Math.PI / 2;
  await holdKey('KeyW', 2);
  check('drive: position clamped +-300', Math.abs(G.player.car.x) <= 300.01, 'x=' + G.player.car.x.toFixed(1));

  // ---- Camera ---------------------------------------------------------------
  tp(-60, -150);
  G.player.exitCar();
  G.player.setPlayer(-60, -150);
  await waitGame(0.4); // let a frame settle the camera to speed 0 first
  const d0 = G.cam.distance, f0 = G.cam.fov;
  // The car is at (-60,-150) — tp moved it there with the player.
  G.player.tryEnterCarAt(-60, -150);
  tp(-120, 24);
  G.keys.KeyW = true;
  const gotFast = await waitFor(() => G.player.car.speed >= 38, 10000);
  G.keys.KeyW = false;
  const d1 = G.cam.distance, f1 = G.cam.fov;
  check('camera: distance + FOV scale with speed', gotFast && d0 < 11.5 && d1 > 13 && f0 < 63 && f1 > 69, 'dist ' + d0.toFixed(1) + '->' + d1.toFixed(1) + ' fov ' + f0.toFixed(1) + '->' + f1.toFixed(1));
  // Drive straight and let the camera settle onto the heading.
  G.player.car.heading = Math.PI / 2;
  G.cam.yaw = Math.PI / 2 + 0.5;
  G.cam.lastDragT = 10;
  G.keys.KeyW = true;
  const eased = await waitFor(() => G.cam.yawError <= 3, 4000);
  G.keys.KeyW = false;
  check('camera: yaw eases to heading (error <= 3 deg)', eased, 'yawError=' + G.cam.yawError.toFixed(2) + ' deg');
  G.player.exitCar();
  G.cam.yaw = 0.001;
  await waitGame(1.5);
  check('camera: no auto-ease on foot', Math.abs(G.cam.yaw - 0.001) < 0.002, 'yaw ' + G.cam.yaw.toFixed(3) + ' -> ' + G.cam.yaw.toFixed(3));

  // ---- Missions -------------------------------------------------------------
  // The drive tests moved the garage car away; put it back on its spot so the
  // M1 interact finds it at the garage.
  const parkGarageCar = () => {
    const c = G.cars.garageCar;
    c.x = -120; c.z = 24; c.speed = 0; c.heading = Math.PI / 2;
    G.cars.syncMesh(c);
  };
  parkGarageCar();
  G.missions.start(0);
  tp(-120, 24);
  G.player.interact();
  check('mission: M1 E prioritizes mission interact AND enters car', G.missions.step === 2 && G.player.inCar, 'step=' + G.missions.step + ' inCar=' + G.player.inCar);
  tp(-60, -168);
  await waitFor(() => G.cash === 500, 4000);
  check('mission: M1 completes (+$500)', G.cash === 500, 'cash=' + G.cash);
  G.missions.start(1);
  tp(264, 60);
  G.player.interact();
  tp(-60, -168);
  await waitFor(() => G.cash === 1300, 4000);
  check('mission: M2 completes (+$800, total $1300)', G.cash === 1300, 'cash=' + G.cash);
  G.missions.start(2);
  await loseHeat();
  check('mission: M3 completes by losing 3 stars (+$1200, total $2500)', G.cash === 2500 && G.police.stars === 0, 'cash=' + G.cash + ' stars=' + G.police.stars);
  G.missions.start(3);
  G.player.exitCar();
  tp(258, 112);
  // Aim at each dealer and shoot until all four are down.
  for (let shot = 0; shot < 40 && G.combat.aliveCount() > 0; shot++) {
    const e = G.combat.enemies.find((en) => en.alive);
    if (!e) break;
    G.cam.yaw = Math.atan2(e.x - G.player.x, e.z - G.player.z);
    G.combat.shoot();
    await waitGame(0.35);
  }
  const m4alive = G.combat.aliveCount();
  tp(264, 120);
  G.player.interact();
  await waitFor(() => G.cash === 4500, 4000);
  check('mission: M4 completes — 4 dealers down, cash taken (+$2000, total $4500)', G.cash === 4500 && m4alive === 0, 'cash=' + G.cash + ' alive=' + m4alive);
  G.missions.start(4);
  tp(60, 232);
  await waitGame(0.6);
  check('mission: M5 auto-pickup at marina (no E, step 2)', G.missions.step === 2, 'step=' + G.missions.step);
  G.timeScale = 4;
  await waitGame(100);
  G.timeScale = 1;
  check('mission: M5 fails after 90 s timeout', G.trace.includes('mission-fail:5'), 'trace=' + G.trace.filter((t) => t.startsWith('mission-fail')).join(','));
  G.missions.start(4);
  tp(60, 232);
  await waitGame(0.6);
  tp(-150, -232);
  await waitFor(() => G.cash === 7000, 4000);
  check('mission: M5 completes (+$2500, total $7000)', G.cash === 7000, 'cash=' + G.cash);
  // M6: get in the garage car, then glue it to the sedan until it stops.
  parkGarageCar();
  G.missions.start(5);
  tp(-120, 24);
  G.player.interact();
  for (let i = 0; i < 30 && G.cars.sedan.orbit.hp > 0; i++) {
    const s = G.cars.sedan;
    tp(s.x, s.z);
    await waitGame(0.3);
  }
  await waitFor(() => G.cash === 10000, 4000);
  check('mission: M6 ram kills the sedan (+$3000, total $10000)', G.cash === 10000, 'cash=' + G.cash);
  G.missions.start(6);
  G.player.exitCar(); // step out of the garage car before stealing the van
  tp(-180, 232);
  G.player.interact();
  const inVan = G.player.car === G.cars.van;
  await loseHeat();
  check('mission: M7 van stolen, heat lost (step 3)', G.missions.step === 3 && inVan, 'van=' + inVan + ' step=' + G.missions.step);
  tp(-60, -168);
  await waitFor(() => G.cash === 14000, 4000);
  check('mission: M7 completes (+$4000, total $14000)', G.cash === 14000, 'cash=' + G.cash);
  // M8: survive in the car (cops cannot hurt a driver), then the yacht.
  tp(-120, 24);
  if (!G.player.inCar) G.player.interact();
  G.missions.start(7);
  G.timeScale = 4;
  await waitGame(70);
  G.timeScale = 1;
  const m8step = G.missions.step;
  tp(60, 232);
  await waitFor(() => G.cash === 19000, 4000);
  check('mission: M8 completes — survived 60 s + yacht (+$5000, total $19000)', G.cash === 19000, 'cash=' + G.cash + ' step was ' + m8step);
  check('mission: all 8 done, total cash $19,000', G.missions.completed.size === 8 && G.cash === 19000, G.missions.completed.size + '/8 cash=' + G.cash);

  // ---- Police ---------------------------------------------------------------
  G.police.setStars(3);
  check('police: 3 stars spawns 5 cruisers + heli', G.police.cars.length === 5 && !!G.police.heli, 'cruisers=' + G.police.cars.length + ' heli=' + !!G.police.heli);
  G.police.setStars(2);
  check('police: 2 stars spawns 2 foot cops, no heli', G.police.cops.length === 2 && !G.police.heli, 'cops=' + G.police.cops.length + ' heli=' + !!G.police.heli);
  G.police.setStars(0);
  check('police: 0 stars clears all units', G.police.cars.length === 0 && G.police.cops.length === 0 && !G.police.heli, 'cars=' + G.police.cars.length);
  G.police.setStars(3);
  const heli3 = !!G.police.heli;
  G.police.setStars(2);
  const heli2 = !!G.police.heli;
  check('police: heli follows the 3-star rule', heli3 === true && heli2 === false, 'heli@3=' + heli3 + ' heli@2=' + heli2);
  G.police.setStars(4);
  check('police: roadblocks appear at 4 stars', G.police.roadblocks.length === 2, G.police.roadblocks.length + ' roadblocks');
  G.police.setStars(3);
  await loseHeat();
  check('police: wanted decays when far from cruisers', G.police.stars === 0, 'stars=' + G.police.stars);
  G.police.setStars(3);
  tp(0, 0);
  await waitGame(0.5); // let one update compute a fresh nearestDist
  const nd0 = G.police.nearestDist;
  await waitGame(3);
  const nd1 = G.police.nearestDist;
  check('police: cruiser closes in, nearestDist tracks', nd1 < nd0, nd0.toFixed(0) + ' -> ' + nd1.toFixed(0) + ' nearest=' + nd1.toFixed(1));
  G.police.setStars(0);

  // ---- Combat ---------------------------------------------------------------
  G.player.exitCar();
  tp(200, 200);
  G.combat.clearEnemies();
  const foe = G.combat.spawnEnemies(1, 200, 210, 0xc22a2a)[0];
  G.cam.yaw = Math.atan2(foe.x - G.player.x, foe.z - G.player.z);
  const hpBefore = foe.hp;
  G.combat.shoot();
  await waitGame(0.4);
  check('combat: pistol shot hits enemy in range', foe.hp === hpBefore - 34, 'hp ' + hpBefore + ' -> ' + foe.hp);
  check('combat: pistol damage is 34', hpBefore - foe.hp === 34, 'dmg=' + (hpBefore - foe.hp));
  G.combat.switchWeapon(1);
  const ammoBefore = G.combat.ammo;
  G.combat.cooldown = 0; // the check is about ammo, not about the cooldown
  G.combat.shoot();
  await waitGame(0.2);
  check('combat: SMG ammo decreases', G.combat.ammo === ammoBefore - 1, ammoBefore + ' -> ' + G.combat.ammo);
  G.combat.switchWeapon(0);
  for (let i = 0; i < 6 && foe.alive; i++) {
    G.cam.yaw = Math.atan2(foe.x - G.player.x, foe.z - G.player.z);
    G.combat.shoot();
    await waitGame(0.35);
  }
  check('combat: enemy dies after enough damage', G.combat.aliveCount() === 0, 'alive=' + G.combat.aliveCount());
  G.combat.clearEnemies();
  const shooter = G.combat.spawnEnemies(1, 200, 208, 0xc22a2a)[0];
  G.player.health = 100; G.player.armour = 0;
  await waitGame(5);
  const hpAfter = G.player.health;
  check('combat: enemy shoots the player (2 dmg per hit)', hpAfter < 100 && (100 - hpAfter) % 2 === 0 && hpAfter >= 88, 'hp 100 -> ' + hpAfter);
  G.combat.clearEnemies();

  // ---- Traffic + pedestrians --------------------------------------------------
  check('traffic: 14 traffic cars', G.cars.traffic.length === 14, String(G.cars.traffic.length));
  // Track the traffic car farthest from the player's car so it cannot be the
  // one braking for us.
  const t0 = G.cars.traffic.reduce((best, t) => {
    const d = dist2(t.x, t.z, G.player.x, G.player.z);
    return d > best.d ? { t, d } : best;
  }, { t: G.cars.traffic[0], d: -1 }).t;
  const tStart = { x: t0.x, z: t0.z };
  await waitGame(5);
  const moved = dist2(tStart.x, tStart.z, t0.x, t0.z);
  check('traffic: cars move along roads', moved > 10, 'moved ' + moved.toFixed(1) + ' m');
  check('pedestrians: 12 walkers', G.pedestrians.list.length === 12, String(G.pedestrians.list.length));
  // Park the garage car 3 m from a walker, get in, and watch it flee.
  const ped = G.pedestrians.list[0];
  const gc = G.cars.garageCar;
  gc.x = ped.x + 3; gc.z = ped.z; gc.speed = 0;
  G.cars.syncMesh(gc);
  G.player.setPlayer(gc.x, gc.z);
  G.player.tryEnterCarAt(gc.x, gc.z);
  const pd0 = dist2(G.player.x, G.player.z, ped.x, ped.z);
  await waitGame(2);
  const pd1 = dist2(G.player.x, G.player.z, ped.x, ped.z);
  check('pedestrians: walker flees a car closer than 6 m', pd0 < 6 && pd1 > 6, pd0.toFixed(1) + ' -> ' + pd1.toFixed(1));
  G.player.exitCar();

  // ---- Radio / save / perf -----------------------------------------------------
  check('radio: 3 stations', G.sound.stations.length === 3, G.sound.stations.map((s) => s.name).join(', '));
  const st0 = G.sound.stationIndex;
  G.sound.nextStation();
  check('radio: next station cycles', G.sound.stationIndex === (st0 + 1) % 3, st0 + ' -> ' + G.sound.stationIndex);
  G.cash = 1234;
  G.saveGame();
  G.cash = 0;
  G.loadSave();
  check('save: save/load roundtrip restores cash', G.cash === 1234, 'cash=' + G.cash);
  const calls = G.renderer.info.render.calls;
  check('perf: draw calls under 600', calls < 600, calls + ' calls');
  const fr0 = G.frames;
  await waitGame(0.5);
  check('perf: frames render (counter advances)', G.frames > fr0, 'frames ' + fr0 + ' -> ' + G.frames);

  // ---- Report -------------------------------------------------------------------
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const lines = results.map((r) => (r.pass ? 'PASS ' : 'FAIL ') + r.name + ' — ' + r.info);
  const text = passed + '/' + total + ' passed\n' + lines.join('\n');
  window.__autopilotResults = results;
  const el = document.getElementById('test-results');
  el.style.display = 'block';
  el.textContent = text;
  document.title = passed === total ? 'AUTOPILOT-PASS' : 'AUTOPILOT-FAIL';
  G.timeScale = 1;
  return { passed, total, results };
}
