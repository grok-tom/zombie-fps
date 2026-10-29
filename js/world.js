import * as THREE from 'three';

/**
 * Build night abandoned city block: ground, buildings, fog, street lamps.
 * Returns colliders (AABB), spawn points, and lamp light refs.
 * @param {THREE.Scene} scene
 * @param {import('./assets.js').GameAssets | null} [assets]
 */
export function createWorld(scene, assets = null) {
  scene.background = new THREE.Color(0x1a2230);
  scene.fog = new THREE.FogExp2(0x1a2230, 0.014);

  const hemi = new THREE.HemisphereLight(0x9bb4d0, 0x1a1510, 0.55);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xc0d4ff, 0.85);
  moon.position.set(-30, 50, 10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 10;
  moon.shadow.camera.far = 120;
  moon.shadow.camera.left = -40;
  moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;
  moon.shadow.camera.bottom = -40;
  moon.shadow.camera.updateProjectionMatrix();
  moon.shadow.bias = -0.0005;
  scene.add(moon);

  // Ground — repeating asphalt when available
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x5a6270,
    roughness: 0.95,
    metalness: 0.05,
  });
  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    'assets/textures/asphalt.png',
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(24, 24);
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;
      groundMat.map = tex;
      groundMat.color.set(0xffffff);
      groundMat.needsUpdate = true;
    },
    undefined,
    () => {
      /* keep flat color fallback */
    }
  );
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle road markings (slightly lighter strip on cross streets)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x4a5160,
    roughness: 0.98,
    metalness: 0,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 70), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  scene.add(road);
  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(70, 10), roadMat);
  road2.rotation.x = -Math.PI / 2;
  road2.position.y = 0.012;
  road2.receiveShadow = true;
  scene.add(road2);

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
    placeBuilding(scene, assets, b, colliders);
  }

  // Outer walls (visible barriers + colliders)
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

  // Street lamps — ≤6 warm point lights for perf; posts still mark the street
  const lampPositions = [
    [-6, -6],
    [6, -8],
    [-7, 8],
    [8, 6],
    [-14, 0],
    [14, -2],
  ];
  const lampLightRefs = [];
  for (const [lx, lz] of lampPositions) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x333840, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.set(lx, 2.75, lz);
    pole.castShadow = true;
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
        emissive: 0xffc070,
        emissiveIntensity: 2.2,
      })
    );
    bulb.position.set(lx, 5.25, lz);
    scene.add(bulb);

    const light = new THREE.PointLight(0xffc070, 6, 24, 2);
    light.position.set(lx, 5.1, lz);
    scene.add(light);
    lampLightRefs.push(light);
  }

  // Debris / crates for flavor
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a5848, roughness: 0.9 });
  const debrisSpots = [
    [3, 4],
    [-4, -3],
    [10, 10],
    [-12, 5],
    [5, -12],
    [-15, -10],
  ];
  for (const [dx, dz] of debrisSpots) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), crateMat);
    crate.position.set(dx, 0.5, dz);
    crate.rotation.y = Math.random() * Math.PI;
    crate.castShadow = true;
    crate.receiveShadow = true;
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

/**
 * Place one building from glTF prototypes or textured box fallback.
 * Collider AABB always matches footprint `b` (gameplay unchanged).
 */
function placeBuilding(scene, assets, b, colliders) {
  let root;
  if (assets && assets.buildings && assets.buildings.length) {
    const proto = assets.buildings[Math.floor(Math.random() * assets.buildings.length)];
    root = proto.clone(true);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sx = b.w / Math.max(size.x, 0.01);
    const sz = b.d / Math.max(size.z, 0.01);
    const s = Math.min(sx, sz);
    root.scale.multiplyScalar(s);
    root.position.set(b.x, -box.min.y * s, b.z);
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  } else {
    root = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({ color: 0x6a7384, roughness: 0.9, metalness: 0.1 })
    );
    root.position.set(b.x, b.h / 2, b.z);
    root.castShadow = true;
    root.receiveShadow = true;
  }
  scene.add(root);
  colliders.push({
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2,
    minY: 0,
    maxY: b.h,
  });
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
