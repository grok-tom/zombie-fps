import * as THREE from 'three';

/**
 * Build night abandoned city block: ground, buildings, fog, street lamps.
 * Returns colliders (AABB) and spawn points.
 */
export function createWorld(scene) {
  scene.background = new THREE.Color(0x3a4a60);
  scene.fog = new THREE.FogExp2(0x4a5a70, 0.006);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x667788, 2.2);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xffffff, 2.0);
  moon.castShadow = false;
  moon.position.set(-20, 40, 10);
  scene.add(moon);

  // Ground
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x7a8494,
    roughness: 0.92,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle road markings
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x6a7384, roughness: 0.95, metalness: 0 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 70), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  scene.add(road);
  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(70, 10), roadMat);
  road2.rotation.x = -Math.PI / 2;
  road2.position.y = 0.012;
  scene.add(road2);

  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x8a96a8,
    roughness: 0.88,
    metalness: 0.15,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x3a4252,
    roughness: 0.8,
    metalness: 0.2,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x1a2030,
    emissive: 0xffeebb,
    emissiveIntensity: 1.6,
    roughness: 0.6,
  });

  const colliders = [];
  const buildings = [
    { x: -18, z: -16, w: 10, h: 12, d: 10 },
    { x: 16, z: -14, w: 12, h: 14, d: 9 },
    { x: -20, z: 12, w: 9, h: 10, d: 11 },
    { x: 18, z: 14, w: 11, h: 13, d: 10 },
    { x: -8, z: -22, w: 8, h: 9, d: 7 },
    { x: 6, z: -24, w: 9, h: 11, d: 6 },
    { x: -10, z: 24, w: 10, h: 10, d: 7 },
    { x: 8, z: 22, w: 8, h: 12, d: 8 },
    { x: -28, z: -2, w: 7, h: 15, d: 14 },
    { x: 28, z: 2, w: 7, h: 14, d: 13 },
    { x: 0, z: -30, w: 14, h: 8, d: 6 },
    { x: -2, z: 30, w: 16, h: 9, d: 5 },
  ];

  for (const b of buildings) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      buildingMat
    );
    mesh.position.y = b.h / 2;
    group.add(mesh);

    // Roof accent
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4),
      accentMat
    );
    roof.position.y = b.h + 0.2;
    group.add(roof);

    // Fake windows
    const winGeo = new THREE.PlaneGeometry(0.8, 1.1);
    const faces = [
      { axis: 'z', sign: 1, lim: b.d / 2 + 0.02 },
      { axis: 'z', sign: -1, lim: b.d / 2 + 0.02 },
      { axis: 'x', sign: 1, lim: b.w / 2 + 0.02 },
      { axis: 'x', sign: -1, lim: b.w / 2 + 0.02 },
    ];
    for (const face of faces) {
      const cols = face.axis === 'z' ? Math.max(2, Math.floor(b.w / 2.2)) : Math.max(2, Math.floor(b.d / 2.2));
      const rows = Math.max(2, Math.floor(b.h / 3));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.35) continue;
          const win = new THREE.Mesh(winGeo, windowMat);
          const u = (c / (cols - 1) - 0.5) * (face.axis === 'z' ? b.w - 1.5 : b.d - 1.5);
          const y = 1.5 + r * 2.4;
          if (face.axis === 'z') {
            win.position.set(u, y, face.sign * face.lim);
            if (face.sign < 0) win.rotation.y = Math.PI;
          } else {
            win.position.set(face.sign * face.lim, y, u);
            win.rotation.y = face.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          group.add(win);
        }
      }
    }

    group.position.set(b.x, 0, b.z);
    scene.add(group);

    colliders.push({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
      minY: 0,
      maxY: b.h,
    });
  }

  // Outer walls (invisible colliders + low visible barriers)
  const wallH = 4;
  const wallThickness = 1.5;
  const half = 38;
  const walls = [
    { x: 0, z: -half, w: 80, d: wallThickness },
    { x: 0, z: half, w: 80, d: wallThickness },
    { x: -half, z: 0, w: wallThickness, d: 80 },
    { x: half, z: 0, w: wallThickness, d: 80 },
  ];
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2a3344,
    roughness: 0.95,
    metalness: 0.05,
  });
  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallH, w.d), wallMat);
    mesh.position.set(w.x, wallH / 2, w.z);
    scene.add(mesh);
    colliders.push({
      minX: w.x - w.w / 2,
      maxX: w.x + w.w / 2,
      minZ: w.z - w.d / 2,
      maxZ: w.z + w.d / 2,
      minY: 0,
      maxY: wallH,
    });
  }

  // Street lamps
  const lampPositions = [
    [-6, -6], [6, -8], [-7, 8], [8, 6],
    [-14, 0], [14, -2], [0, -16], [0, 16],
    [-22, 8], [22, -10],
  ];
  const lampLightRefs = [];
  for (const [lx, lz] of lampPositions) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x333840, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.set(lx, 2.75, lz);
    scene.add(pole);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x444a55, metalness: 0.5, roughness: 0.45 })
    );
    head.position.set(lx, 5.5, lz);
    scene.add(head);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffeeb0,
        emissive: 0xffcc66,
        emissiveIntensity: 2.5,
      })
    );
    bulb.position.set(lx, 5.25, lz);
    scene.add(bulb);

    const light = new THREE.PointLight(0xfff0d0, 12, 40, 1.0);
    light.position.set(lx, 5.1, lz);
    scene.add(light);
    lampLightRefs.push(light);
  }

  // Debris / crates for flavor
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a5848, roughness: 0.9 });
  const debrisSpots = [
    [3, 4], [-4, -3], [10, 10], [-12, 5], [5, -12], [-15, -10],
  ];
  for (const [dx, dz] of debrisSpots) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), crateMat);
    crate.position.set(dx, 0.5, dz);
    crate.rotation.y = Math.random() * Math.PI;
    scene.add(crate);
    colliders.push({
      minX: dx - 0.7,
      maxX: dx + 0.7,
      minZ: dz - 0.7,
      maxZ: dz + 0.7,
      minY: 0,
      maxY: 1.1,
    });
  }

  // Spawn points around map edges (clear of buildings)
  const spawnPoints = [
    new THREE.Vector3(-24, 0, -24),
    new THREE.Vector3(24, 0, -24),
    new THREE.Vector3(-24, 0, 24),
    new THREE.Vector3(24, 0, 24),
    new THREE.Vector3(0, 0, -26),
    new THREE.Vector3(0, 0, 26),
    new THREE.Vector3(-26, 0, 0),
    new THREE.Vector3(26, 0, 0),
    new THREE.Vector3(-20, 0, 18),
    new THREE.Vector3(20, 0, -18),
  ];

  return { colliders, spawnPoints, lampLights: lampLightRefs };
}

/** Resolve player XZ position against AABB colliders (cylinder-ish radius). */
export function resolveCollision(pos, radius, colliders) {
  let x = pos.x;
  let z = pos.z;
  for (const c of colliders) {
    const nearestX = Math.max(c.minX, Math.min(x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq < 1e-8) {
        // Center inside box — push out along smallest penetration
        const penLeft = x - c.minX + radius;
        const penRight = c.maxX - x + radius;
        const penTop = z - c.minZ + radius;
        const penBottom = c.maxZ - z + radius;
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);
        if (minPen === penLeft) x = c.minX - radius;
        else if (minPen === penRight) x = c.maxX + radius;
        else if (minPen === penTop) z = c.minZ - radius;
        else z = c.maxZ + radius;
      } else {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        x += dx * push;
        z += dz * push;
      }
    }
  }
  // Clamp to playable area
  x = Math.max(-36, Math.min(36, x));
  z = Math.max(-36, Math.min(36, z));
  pos.x = x;
  pos.z = z;
  return pos;
}
