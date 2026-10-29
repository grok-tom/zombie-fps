import * as THREE from 'three';
import { resolveCollision } from './world.js';
import { cloneZombie } from './assets.js';

const ZOMBIE_RADIUS = 0.45;
const CONTACT_RANGE = 1.35;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN = 0.85;
const TARGET_HEIGHT = 1.85;
const FLASH_HEX = 0xff6666;
const FLASH_INTENSITY = 0.6;

function createBoxZombieMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x9ab090,
    roughness: 0.9,
    metalness: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x708068,
    roughness: 0.92,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: 0xff3300,
    emissiveIntensity: 6.0,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), bodyMat);
  torso.position.y = 1.15;
  group.add(torso);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.28), darkMat);
  pelvis.position.y = 0.65;
  group.add(pelvis);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), bodyMat);
  head.position.y = 1.78;
  group.add(head);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
  eyeL.position.set(-0.1, 1.82, 0.18);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  group.add(eyeR);

  const armGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.42, 1.2, 0.05);
  armL.rotation.z = 0.35;
  armL.rotation.x = -0.5;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.42, 1.2, 0.05);
  armR.rotation.z = -0.35;
  armR.rotation.x = -0.55;
  group.add(armR);

  const legGeo = new THREE.BoxGeometry(0.18, 0.7, 0.2);
  const legL = new THREE.Mesh(legGeo, darkMat);
  legL.position.set(-0.14, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, darkMat);
  legR.position.set(0.14, 0.35, 0);
  group.add(legR);

  group.userData.armL = armL;
  group.userData.armR = armR;
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.head = head;

  const glow = new THREE.PointLight(0xff3300, 1.2, 4);
  glow.position.set(0, 1.8, 0.3);
  group.add(glow);

  return group;
}

function cloneMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (Array.isArray(o.material)) {
      o.material = o.material.map((m) => m.clone());
    } else {
      o.material = o.material.clone();
    }
  });
}

function createZombieMesh(assets) {
  let cloned = null;
  try {
    cloned = assets ? cloneZombie(assets) : null;
  } catch (e) {
    console.warn('cloneZombie failed, using box fallback', e);
    cloned = null;
  }

  if (cloned) {
    cloneMaterials(cloned);
    // Measure unscaled bounds for feet + height fit
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = TARGET_HEIGHT / Math.max(size.y, 0.01);
    cloned.scale.setScalar(s);
    cloned.position.y = -box.min.y * s;
    const wrap = new THREE.Group();
    wrap.add(cloned);
    wrap.userData.visual = cloned;
    wrap.userData.gltf = true;
    return wrap;
  }

  return createBoxZombieMesh();
}

function pickLocomotionClip(clips) {
  if (!clips || !clips.length) return null;
  const prefer = [/walk/i, /run/i, /idle/i];
  for (const re of prefer) {
    const short = clips.find((c) => re.test(c.name) && !c.name.includes('|'));
    if (short) return short;
    const any = clips.find((c) => re.test(c.name));
    if (any) return any;
  }
  return clips[0];
}

function forEachEmissiveMaterial(root, fn) {
  root.traverse((c) => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      if (m && m.emissive) fn(m);
    }
  });
}

function applyHitFlash(mesh) {
  forEachEmissiveMaterial(mesh, (m) => {
    if (m.userData._flashSaved == null) {
      m.userData._flashSaved = {
        hex: m.emissive.getHex(),
        intensity: m.emissiveIntensity ?? 0,
      };
    }
    m.emissive.setHex(FLASH_HEX);
    m.emissiveIntensity = FLASH_INTENSITY;
  });
}

function clearHitFlash(mesh) {
  forEachEmissiveMaterial(mesh, (m) => {
    const saved = m.userData._flashSaved;
    if (!saved) return;
    m.emissive.setHex(saved.hex);
    m.emissiveIntensity = saved.intensity;
    delete m.userData._flashSaved;
  });
}

export class ZombieManager {
  constructor(scene, colliders, assets = null) {
    this.scene = scene;
    this.colliders = colliders;
    this.assets = assets;
    this.zombies = [];
    this.hitMeshes = [];
  }

  clear() {
    for (const z of this.zombies) {
      if (z.mixer) {
        z.mixer.stopAllAction();
        z.mixer.uncacheRoot?.(z.mesh.userData.visual || z.mesh);
      }
      this.scene.remove(z.mesh);
    }
    this.zombies.length = 0;
    this.hitMeshes.length = 0;
  }

  spawn(position, { hp = 60, speed = 2.2 } = {}) {
    const mesh = createZombieMesh(this.assets);
    mesh.position.set(position.x, 0, position.z);
    this.scene.add(mesh);

    let mixer = null;
    const clips = this.assets?.zombieClips;
    const visual = mesh.userData.visual;
    if (visual && clips && clips.length) {
      mixer = new THREE.AnimationMixer(visual);
      const clip = pickLocomotionClip(clips);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset().play();
      }
    }

    const zombie = {
      mesh,
      hp,
      maxHp: hp,
      speed,
      alive: true,
      contactCd: 0,
      bob: Math.random() * Math.PI * 2,
      hitFlash: 0,
      mixer,
      visualBaseY: visual ? visual.position.y : 0,
    };
    this.zombies.push(zombie);
    this._rebuildHitList();
    return zombie;
  }

  _rebuildHitList() {
    this.hitMeshes = this.zombies.filter((z) => z.alive).map((z) => z.mesh);
  }

  findByObject(obj) {
    let o = obj;
    while (o) {
      for (const z of this.zombies) {
        if (z.mesh === o) return z;
      }
      o = o.parent;
    }
    return null;
  }

  damageZombie(zombie, amount) {
    if (!zombie || !zombie.alive) return false;
    zombie.hp -= amount;
    zombie.hitFlash = 0.15;
    applyHitFlash(zombie.mesh);
    if (zombie.hp <= 0) {
      zombie.alive = false;
      if (zombie.mixer) {
        zombie.mixer.stopAllAction();
      }
      clearHitFlash(zombie.mesh);
      this.scene.remove(zombie.mesh);
      this._rebuildHitList();
      return true; // died
    }
    return false;
  }

  aliveCount() {
    return this.zombies.filter((z) => z.alive).length;
  }

  update(dt, playerPos, onContact) {
    for (const z of this.zombies) {
      if (!z.alive) continue;

      if (z.hitFlash > 0) {
        z.hitFlash -= dt;
        if (z.hitFlash <= 0) {
          clearHitFlash(z.mesh);
        }
      }

      const dx = playerPos.x - z.mesh.position.x;
      const dz = playerPos.z - z.mesh.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const nx = dx / dist;
      const nz = dz / dist;

      z.mesh.position.x += nx * z.speed * dt;
      z.mesh.position.z += nz * z.speed * dt;
      resolveCollision(z.mesh.position, ZOMBIE_RADIUS, this.colliders);
      z.mesh.position.y = 0;

      z.mesh.rotation.y = Math.atan2(nx, nz);

      z.bob += dt * (4 + z.speed);
      if (z.mixer) {
        z.mixer.update(dt);
      } else {
        const swing = Math.sin(z.bob) * 0.35;
        const { armL, armR, legL, legR } = z.mesh.userData;
        if (armL || armR || legL || legR) {
          if (armL) armL.rotation.x = -0.5 + swing;
          if (armR) armR.rotation.x = -0.55 - swing;
          if (legL) legL.rotation.x = swing * 0.6;
          if (legR) legR.rotation.x = -swing * 0.6;
        } else if (z.mesh.userData.visual) {
          z.mesh.userData.visual.position.y =
            z.visualBaseY + Math.sin(z.bob) * 0.03;
        }
      }

      if (z.contactCd > 0) z.contactCd -= dt;
      if (dist < CONTACT_RANGE && z.contactCd <= 0) {
        z.contactCd = CONTACT_COOLDOWN;
        if (onContact) onContact(CONTACT_DAMAGE);
      }
    }
  }

  /** Drop position of dead zombies that need loot (caller tracks). */
  getMeshesForRaycast() {
    return this.hitMeshes;
  }
}
