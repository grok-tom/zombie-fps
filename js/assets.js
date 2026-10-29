import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

function prepare(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    }
  });
  return root;
}

function loadGltf(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

export async function loadGameAssets() {
  const buildings = [];
  // Concrete filenames from Task 1 (a–c required; d/e/skyscraper optional extras)
  const buildingFiles = [
    'assets/city/building-a.glb',
    'assets/city/building-b.glb',
    'assets/city/building-c.glb',
    'assets/city/building-d.glb',
    'assets/city/building-e.glb',
    'assets/city/building-skyscraper-a.glb',
  ];
  for (const f of buildingFiles) {
    try {
      const g = await loadGltf(f);
      buildings.push(prepare(g.scene));
    } catch (e) {
      console.warn('building skip', f, e);
    }
  }

  let zombiePrototype;
  let zombieClips = [];
  try {
    const z = await loadGltf('assets/characters/zombie.glb');
    zombiePrototype = prepare(z.scene);
    zombieClips = z.animations || [];
  } catch (e) {
    console.warn('zombie glb failed, caller must fallback', e);
    zombiePrototype = null;
  }

  let pistolPrototype = null;
  let smgPrototype = null;
  try {
    const p = await loadGltf('assets/weapons/pistol.glb');
    pistolPrototype = prepare(p.scene);
  } catch (e) {
    console.warn('pistol glb failed', e);
  }
  try {
    const s = await loadGltf('assets/weapons/smg.glb');
    smgPrototype = prepare(s.scene);
  } catch (_) {
    smgPrototype = null;
  }

  return {
    buildings,
    zombiePrototype,
    zombieClips,
    pistolPrototype,
    smgPrototype,
    ready: true,
  };
}

export function cloneZombie(assets) {
  if (!assets.zombiePrototype) return null;
  return assets.zombiePrototype.clone(true);
}

export function clonePistol(assets) {
  if (!assets.pistolPrototype) return null;
  return assets.pistolPrototype.clone(true);
}
