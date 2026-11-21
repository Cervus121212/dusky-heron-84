// COSTA LUNA city: ground, roads, 69 buildings, beach, docks, marina, sun, skyline.
// All geometry is procedural (canvas textures for facades, billboards and signs),
// all placement is deterministic from the seeded RNG, so the world is identical
// on every load. Draw calls are kept low with shared geometries and materials.

import * as THREE from 'three';
import { mulberry32, clamp, pick } from './util.js';

const FACADE_COLORS = [0xd8c9a8, 0xc9a06a, 0xa8b8c9, 0xd8a08a, 0xb8c9a8, 0xc9b8d8];
const ROOF_COLORS = [0x8a4a3a, 0x4a6a8a, 0x6a8a4a, 0x8a6a3a, 0x5a5a6a, 0x9a3a4a, 0x3a7a6a];

function facadeTexture(base, windows, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 256);
  // Slight vertical shading + grime at the base.
  const grad = x.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  x.fillStyle = grad; x.fillRect(0, 0, 128, 256);
  // Window grid.
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = rng() < litRatio;
      x.fillStyle = lit ? '#ffd97a' : '#2a3542';
      x.fillRect(12 + col * 28, 14 + row * 30, 18, 20);
      x.fillStyle = 'rgba(255,255,255,0.25)';
      x.fillRect(12 + col * 28, 14 + row * 30, 18, 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textTexture(lines, w, h, bg, fg, font) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = font || `bold ${Math.floor(h / 3.4)}px Arial`;
  lines.forEach((ln, i) => {
    x.fillText(ln, w / 2, h * (0.32 + i * 0.36));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const S = 1024, HALF = 288;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  const px = (m) => ((m + HALF) / (HALF * 2)) * S;
  const pw = (m) => (m / (HALF * 2)) * S;
  // Land base.
  x.fillStyle = '#454c55'; x.fillRect(0, 0, S, S);
  // City blocks (slightly lighter than the base).
  x.fillStyle = '#565e68';
  for (let bx = -224; bx <= 224; bx += 64) {
    for (let bz = -224; bz <= 224; bz += 64) {
      if (bz === 224 || bx === 224) continue;
      x.fillRect(px(bx - 24), px(bz - 24), pw(48), pw(48));
    }
  }
  // Parks.
  x.fillStyle = '#6a9a5a';
  x.fillRect(px(-24), px(104), pw(48), pw(48));
  x.fillRect(px(104), px(-152), pw(48), pw(48));
  // Roads: 16 m strips on every 64 m grid line.
  x.fillStyle = '#9aa3ad';
  for (let g = -256; g <= 256; g += 64) {
    x.fillRect(0, px(g - 8), S, pw(16));
    x.fillRect(px(g - 8), 0, pw(16), S);
  }
  // Center dashes on the roads (baked into the texture: zero draw calls).
  x.fillStyle = '#d8c25a';
  for (let g = -256; g <= 256; g += 64) {
    for (let d = -272; d < 288; d += 32) {
      x.fillRect(px(d), px(g - 1), pw(14), pw(2));
      x.fillRect(px(g - 1), px(d), pw(2), pw(14));
    }
  }
  // Beach sand (z >= 224) and marina basin.
  x.fillStyle = '#dcc78f';
  x.fillRect(0, px(224), S, S - px(224));
  x.fillStyle = '#2a7a9e';
  x.fillRect(px(16), px(224), pw(96), pw(64));
  // Docks apron (x >= 224).
  x.fillStyle = '#96999e';
  x.fillRect(px(224), 0, S - px(224), px(224));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(G) {
  const rng = mulberry32(G.seed);
  const scene = G.scene;
  const town = {
    buildings: [],
    groundHalf: 288,
    sunPos: new THREE.Vector3(-260, 78, 330),
    yachtPos: { x: 60, z: 232 },
    dayFactor: 0, // 0 = golden hour, 1 = dusk
  };

  // --- Sky, fog, lights -------------------------------------------------
  scene.background = new THREE.Color(0xef9e58);
  scene.fog = new THREE.Fog(0xe8a56b, 220, 720);
  const hemi = new THREE.HemisphereLight(0x87b5d6, 0x8b6f47, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-260, 190, 330);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  town.sunLight = sun;
  town.hemi = hemi;

  // --- Ground -----------------------------------------------------------
  const groundTex = groundTexture();
  groundTex.anisotropy = 1; // software GL: anisotropic filtering is very slow per pixel
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(576, 576),
    // Lambert, not Standard: the ground covers most of the screen and the
    // matte PBR pipeline costs ~0.4 us/px in SwiftShader for nothing visible.
    new THREE.MeshLambertMaterial({ map: groundTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Sea beyond the beach.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 160),
    new THREE.MeshStandardMaterial({ color: 0x2a7a9e, roughness: 0.35, metalness: 0.1 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.15, 288 + 80);
  scene.add(sea);

  // --- Sun disc + halo ---------------------------------------------------
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(36, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8a1e, fog: false })
  );
  sunDisc.position.copy(town.sunPos);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(58, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.28, fog: false, depthWrite: false })
  );
  halo.position.copy(town.sunPos).add(new THREE.Vector3(0, 0, -2));
  halo.lookAt(0, 20, 0);
  scene.add(halo);
  town.sunDisc = sunDisc;
  town.sunHalo = halo;

  // --- Buildings (exactly 69) -------------------------------------------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = FACADE_COLORS.map((col, i) =>
    new THREE.MeshStandardMaterial({
      map: facadeTexture('#' + col.toString(16).padStart(6, '0'), 0, 0.35, mulberry32(100 + i)),
      roughness: 0.85, metalness: 0.05,
    }));
  const roofMats = ROOF_COLORS.map((col) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0 }));
  const plainMats = FACADE_COLORS.map((col) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0 }));

  function addBuilding(x, z, w, d, h, textured) {
    const mat = textured ? pick(rng, facadeMats) : pick(rng, plainMats);
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const b = { x, z, hx: w / 2, hz: d / 2, h, mesh };
    town.buildings.push(b);
    // Roof on ~35% of buildings.
    if (rng() < 0.35) {
      const roof = new THREE.Mesh(boxGeo, pick(rng, roofMats));
      roof.scale.set(w * 0.94, 1.2, d * 0.94);
      roof.position.set(x, h + 0.6, z);
      roof.castShadow = true;
      scene.add(roof);
    }
    return b;
  }

  // The collision-test building: AABB x[-245,-225], z[-245,-225].
  addBuilding(-235, -235, 20, 20, 24, true);
  // One building per eligible block, then second buildings until exactly 69.
  const blocks = [];
  for (let bx = -224; bx <= 224; bx += 64) {
    for (let bz = -224; bz <= 224; bz += 64) {
      if (bz === 224 || bx === 224) continue;
      if (bx === -224 && bz === -224) continue; // already placed above
      blocks.push([bx, bz]);
    }
  }
  for (const [bx, bz] of blocks) {
    const w = 18 + rng() * 12, d = 18 + rng() * 12, h = 12 + rng() * 33;
    addBuilding(bx + (rng() - 0.5) * 10, bz + (rng() - 0.5) * 10, w, d, h, rng() < 0.7);
  }
  // Second pass: extra buildings on the same blocks until the count is 69.
  let bi = 0;
  while (town.buildings.length < 69 && bi < blocks.length * 2) {
    const [bx, bz] = blocks[bi % blocks.length];
    bi++;
    if (rng() < 0.45) {
      const w = 14 + rng() * 10, d = 14 + rng() * 10, h = 10 + rng() * 22;
      addBuilding(bx + (rng() - 0.5) * 16, bz + (rng() - 0.5) * 16, w, d, h, false);
    }
  }
  // Safety: if the loop above still missed (it cannot with 48 blocks), pad downtown.
  while (town.buildings.length < 69) {
    addBuilding(-32 + (town.buildings.length % 5) * 8, -96 + Math.floor(town.buildings.length / 5) * 8, 14, 14, 12, false);
  }

  // --- Beach props -------------------------------------------------------
  const palmTrunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
  const palmTopGeo = new THREE.ConeGeometry(3.2, 4.5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0x3f8a4a, roughness: 0.9 });
  const palmSpots = [];
  for (let i = 0; i < 16; i++) palmSpots.push([-260 + i * 34 + rng() * 8, 236 + rng() * 40]);
  palmSpots.push([-160, 120], [120, 130], [-40, 180], [200, 60]);
  const trunks = new THREE.InstancedMesh(palmTrunkGeo, trunkMat, palmSpots.length);
  const tops = new THREE.InstancedMesh(palmTopGeo, topMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 4.5, z); trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 10.5, z); tops.setMatrixAt(i, m4);
  });
  trunks.castShadow = true; tops.castShadow = true;
  scene.add(trunks); scene.add(tops);

  // Umbrellas + towels on the sand.
  const umbGeo = new THREE.ConeGeometry(3, 1.6, 8);
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
  const umbCols = [0xff5a5a, 0xffd23e, 0x3aa7ff, 0x7dff9a];
  const umbs = new THREE.InstancedMesh(umbGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), 4);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }), 4);
  [[-40, 284], [10, 286], [120, 283], [170, 287]].forEach(([x, z], i) => {
    m4.makeTranslation(x, 3.4, z); umbs.setMatrixAt(i, m4);
    umbs.setColorAt(i, new THREE.Color(umbCols[i]));
    m4.makeTranslation(x, 1.3, z); poles.setMatrixAt(i, m4);
  });
  scene.add(umbs); scene.add(poles);
  const towelCols = [0xff5a5a, 0x3aa7ff, 0xffd23e, 0xff8ac2, 0x7dff9a, 0xc9b8d8];
  const towels = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }), 6);
  [[-46, 288], [4, 290], [114, 287], [164, 291], [-120, 284], [60, 288]].forEach(([x, z], i) => {
    m4.makeRotationX(-Math.PI / 2); m4.setPosition(x, 0.06, z);
    towels.setMatrixAt(i, m4);
    towels.setColorAt(i, new THREE.Color(towelCols[i]));
  });
  scene.add(towels);

  // Lifeguard tower at (-80, 288).
  const tower = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 });
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 0.25), legMat);
    leg.position.set(lx, 2.5, lz); tower.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xff5a3a, roughness: 0.8 }));
  cabin.position.y = 6; cabin.castShadow = true; tower.add(cabin);
  const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 3.8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
  towerRoof.position.y = 7.3; tower.add(towerRoof);
  tower.position.set(-80, 0, 288);
  scene.add(tower);

  // --- Docks -------------------------------------------------------------
  // Warehouses (part of the skyline, kept OUT of town.buildings so the city
  // building count stays exactly 69; they still collide).
  town.warehouses = [];
  const whMat = new THREE.MeshStandardMaterial({ color: 0x7a7f86, roughness: 0.9 });
  for (const [wx, wz, ww] of [[250, -120, 34], [252, 40, 30], [250, 180, 36]]) {
    const wh = new THREE.Mesh(boxGeo, whMat);
    wh.scale.set(ww, 12, 22);
    wh.position.set(wx, 6, wz);
    wh.castShadow = true; wh.receiveShadow = true;
    scene.add(wh);
    town.warehouses.push({ x: wx, z: wz, hx: ww / 2, hz: 11, h: 12, mesh: wh });
  }
  // 4 floodlights, one at (258, 126).
  const floodMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 2.2 });
  for (const [fx, fz] of [[258, 126], [240, -60], [262, 200], [238, 160]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 11, 6), floodMat);
    pole.position.set(fx, 5.5, fz); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.8), lampMat);
    lamp.position.set(fx, 11.2, fz); scene.add(lamp);
  }

  // --- Marina + yacht La Sirena ------------------------------------------
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.2 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 16), hullMat);
  hull.position.set(60, 0.9, 232); hull.castShadow = true;
  scene.add(hull);
  const yachtTop = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 9),
    new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.5 }));
  yachtTop.position.set(60, 3.2, 232); yachtTop.castShadow = true;
  scene.add(yachtTop);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }));
  mast.position.set(60, 8, 228); scene.add(mast);
  // Small boats in the marina basin.
  const boatCols = [0x3a76c4, 0xff5a5a, 0x7dff9a];
  [[36, 244], [88, 246], [60, 256]].forEach(([bx, bz], i) => {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 7),
      new THREE.MeshStandardMaterial({ color: boatCols[i], roughness: 0.5 }));
    boat.position.set(bx, 0.6, bz); boat.rotation.y = (i - 1) * 0.35;
    boat.castShadow = true;
    scene.add(boat);
  });

  // --- Billboards facing the beach ---------------------------------------
  function billboard(x, z, lines, bg, fg) {
    const tex = textTexture(lines, 512, 256, bg, fg, 'bold 64px Arial');
    const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 11),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    board.position.set(x, 16, z);
    board.rotation.y = 0; // faces +z, toward the beach
    scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 10, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 }));
    post.position.set(x, 5, z - 0.4);
    scene.add(post);
  }
  billboard(-120, 210, ['HOTEL', 'MIRAMAR'], '#123a5a', '#ffd23e');
  billboard(120, 210, ['CASINO', 'DEL MAR'], '#5a123a', '#7dff9a');

  // --- District signs ------------------------------------------------------
  const districts = [
    ['PALM BEACH', -60, 200], ['THE DOCKS', 200, 60], ['DOWNTOWN', 0, 0],
    ['NORTHSIDE', -60, -200], ['WEST END', -200, -60], ['EASTSIDE', 160, -60],
    ['THE MARINA', 60, 200],
  ];
  for (const [name, sx, sz] of districts) {
    const tex = textTexture([name], 512, 96, '#10202e', '#ffe9a8', 'bold 44px Arial');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
    sign.position.set(sx, 4.4, sz);
    scene.add(sign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 5),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }));
    post.position.set(sx, 2.2, sz);
    scene.add(post);
  }

  // --- Queries -------------------------------------------------------------
  town.districtAt = (x, z) => {
    if (x >= 224) return 'THE DOCKS';
    if (z >= 224) {
      if (x >= 16 && x <= 112) return 'THE MARINA';
      return 'PALM BEACH';
    }
    if (z < -128) return 'NORTHSIDE';
    if (x < -128) return 'WEST END';
    if (x > 128) return 'EASTSIDE';
    return 'DOWNTOWN';
  };

  // Push a circle out of every building AABB (slide along walls: caller may
  // resolve one axis at a time). Returns the corrected position + hit flag.
  town.collideCircle = (x, z, r) => {
    let hit = false;
    const solids = town.buildings.concat(town.warehouses);
    for (const b of solids) {
      const minX = b.x - b.hx - r, maxX = b.x + b.hx + r;
      const minZ = b.z - b.hz - r, maxZ = b.z + b.hz + r;
      if (x > minX && x < maxX && z > minZ && z < maxZ) {
        const dxl = x - minX, dxr = maxX - x, dzl = z - minZ, dzr = maxZ - z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = minX; else if (m === dxr) x = maxX;
        else if (m === dzl) z = minZ; else z = maxZ;
        hit = true;
      }
    }
    return { x, z, hit };
  };

  town.buildingAt = (x, z) => {
    for (const b of town.buildings.concat(town.warehouses)) {
      if (Math.abs(x - b.x) <= b.hx && Math.abs(z - b.z) <= b.hz) return b;
    }
    return null;
  };

  // Daylight slides toward dusk over ~8 minutes (dayLength 480 s).
  town.updateDay = (elapsed) => {
    const f = clamp(elapsed / 480, 0, 1);
    town.dayFactor = f;
    sun.color.setHex(f < 0.5 ? 0xffd9a0 : 0xff8a50);
    sun.intensity = 2.4 - f * 0.9;
    hemi.intensity = 0.75 - f * 0.25;
    scene.background.setHex(f < 0.5 ? 0xef9e58 : 0xc96a4a);
    town.sunDisc.material.color.setHex(f < 0.5 ? 0xff8a1e : 0xff5a14);
  };

  // The city building count is exactly 69 (warehouses live separately).
  town.cityBuildingCount = town.buildings.length;
  return town;
}
