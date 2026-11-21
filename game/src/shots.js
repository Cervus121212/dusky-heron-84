// Screenshot staging for COSTA LUNA (?shot=cover|chase|mission|title).
// Each pose freezes the world (shot mode: no AI, no camera drift) and sets
// document.title to SHOT-READY once the frame is composed. The CDP driver
// then captures the screenshot. The first screenshot by name is the cover,
// so `cover` must show the most complete frame: a chase with the wanted level,
// the minimap and a mission objective on the HUD.

export function stageShot(G, name) {
  G.shotMode = true;
  G.state = 'playing';
  document.getElementById('start').style.display = 'none';
  const placeCar = (car, x, z, heading) => {
    car.x = x; car.z = z; car.heading = heading; car.speed = 0;
    G.cars.syncMesh(car);
  };
  const setStarsFrozen = (n) => {
    G.police.setStars(n);
    // Freeze every cruiser where it stands (no chase while staging).
    for (const c of G.police.cars) c.speed = 0;
  };

  if (name === 'cover') {
    // Chase down the east-west road at z=64, toward the dusk sun: the player
    // car big in frame, cruisers flanking behind it, Air One above.
    G.missions.start(2); // Hot Pursuit: 3 stars, "lose the cops" objective
    G.player.tryEnterCarAt(-120, 24);
    placeCar(G.player.car, 0, 64, -Math.PI / 2);
    G.player.x = 0; G.player.z = 64;
    setStarsFrozen(3);
    // Cruisers cutting across the road ahead of the player, heli high in the
    // dusk sky to the west.
    const spots = [[-14, 58], [-22, 70], [-30, 64]];
    G.police.cars.forEach((c, i) => {
      if (spots[i]) {
        c.x = spots[i][0]; c.z = spots[i][1];
        c.heading = Math.PI / 2;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
      }
    });
    if (G.police.heli) {
      G.police.heli.angle = 2.2;
      G.police.heli.group.position.set(-45, 26, 30);
      G.police.heli.x = -45; G.police.heli.z = 30;
    }
    G.cam.stage([12, 3.5, 70], [-30, 2, 62]);
    G.display.msg('HOT PURSUIT — lose the cops!', 5000);
  } else if (name === 'chase') {
    G.missions.start(2);
    G.player.tryEnterCarAt(-120, 24);
    placeCar(G.player.car, 0, -100, Math.PI);
    G.player.x = 0; G.player.z = -100;
    setStarsFrozen(3);
    const spots = [[-4, -60], [6, -72]];
    G.police.cars.forEach((c, i) => {
      if (spots[i]) {
        c.x = spots[i][0]; c.z = spots[i][1];
        c.heading = Math.PI;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
      }
    });
    G.cam.stage([-6, 5, -78], [0, 2, -100]);
  } else if (name === 'mission') {
    // Dockside deal at the docks: dealers visible, mission dialog up.
    G.missions.start(3);
    G.player.setPlayer(256, 112);
    G.player.heading = Math.PI / 2;
    G.player.syncMesh();
    G.combat.spawnEnemies(4, 264, 120, 0xc22a2a);
    G.display.dialog('Lena Cruz', 'Viktor\'s boys took my cut. Four of them, dock 120. Take it back, Rico.', 15000);
    document.getElementById('dialog').classList.add('shot-mission');
    // From the sea side looking north: the dealers and Rico in front, the
    // city skyline behind them.
    G.cam.stage([266, 7, 152], [262, 2, 116]);
  } else if (name === 'title') {
    // Sunset skyline over the beach: the start screen stays up.
    G.state = 'title';
    document.getElementById('start').style.display = 'flex';
    G.cam.stage([0, 55, 265], [0, 8, 0]);
  } else {
    G.cam.stage([0, 60, 200], [0, 0, 0]);
  }
  G.hud.refresh();
  // One rendered frame, then signal readiness.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { document.title = 'SHOT-READY'; });
  });
}
