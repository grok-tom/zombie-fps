import * as THREE from 'three';
import { resolveCollision } from './world.js';
import { cloneZombie } from './assets.js';

const ZOMBIE_RADIUS = 0.45;
const CONTACT_RANGE = 1.35;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN = 0.85;
const ATTACK_POSE_TIME = 0.55;
const STAGGER_TIME = 0.28;
const STAGGER_SPEED = 4.5; // m/s away from player while staggering
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


function spawnClawBurst(scene, list, playerPos, zombiePos) {
  // World-space slash + blood near player (eye height), unique geo/mat each
  const mid = new THREE.Vector3(
    playerPos.x * 0.65 + zombiePos.x * 0.35,
    1.35,
    playerPos.z * 0.65 + zombiePos.z * 0.35
  );
  const toward = new THREE.Vector3(
    playerPos.x - zombiePos.x,
    0,
    playerPos.z - zombiePos.z
  ).normalize();

  // Two slash planes
  for (let i = 0; i < 2; i++) {
    const geo = new THREE.PlaneGeometry(0.55 + Math.random() * 0.2, 0.07);
    const mat = new THREE.MeshBasicMaterial({
      color: i === 0 ? 0xff3344 : 0xaa1122,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.position.y += (Math.random() - 0.5) * 0.25;
    mesh.position.x += (Math.random() - 0.5) * 0.2;
    mesh.position.z += (Math.random() - 0.5) * 0.2;
    mesh.lookAt(playerPos.x, mesh.position.y, playerPos.z);
    mesh.rotation.z = (i === 0 ? 1 : -1) * (0.55 + Math.random() * 0.35);
    scene.add(mesh);
    list.push({
      mesh,
      vel: toward.clone().multiplyScalar(1.2 + Math.random()),
      life: 0.28 + Math.random() * 0.1,
      maxLife: 0.32,
      kind: 'slash',
    });
  }

  // Blood droplets
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.SphereGeometry(0.03 + Math.random() * 0.025, 5, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbb1a1a,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.position.y += (Math.random() - 0.5) * 0.3;
    const vel = new THREE.Vector3(
      toward.x * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2.5,
      1.5 + Math.random() * 3,
      toward.z * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2.5
    );
    scene.add(mesh);
    list.push({
      mesh,
      vel,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.5,
      kind: 'blood',
    });
  }
}

function disposeFxItem(scene, item) {
  scene.remove(item.mesh);
  item.mesh.geometry.dispose();
  if (Array.isArray(item.mesh.material)) {
    for (const m of item.mesh.material) m.dispose();
  } else {
    item.mesh.material.dispose();
  }
}

function applyAttackPose(z, strength) {
  // strength 1 → peak raise, 0 → rest (walk pose overwritten that frame)
  const { armL, armR } = z.mesh.userData;
  if (armL || armR) {
    if (armL) {
      armL.rotation.x = -0.5 - strength * 1.5;
      armL.rotation.z = 0.35 + strength * 0.75;
    }
    if (armR) {
      armR.rotation.x = -0.55 - strength * 1.65;
      armR.rotation.z = -0.35 - strength * 0.75;
    }
  } else if (z.mesh.userData.visual) {
    // glTF: lean + slight pitch toward player
    z.mesh.userData.visual.rotation.x = -strength * 0.38;
  }
}

function applyStaggerPose(z, strength) {
  // strength 1 → peak lean-back from hit, 0 → rest
  const { armL, armR } = z.mesh.userData;
  if (armL || armR) {
    if (armL) {
      armL.rotation.x = -0.5 + strength * 0.45;
      armL.rotation.z = 0.35 - strength * 0.2;
    }
    if (armR) {
      armR.rotation.x = -0.55 + strength * 0.45;
      armR.rotation.z = -0.35 + strength * 0.2;
    }
  } else if (z.mesh.userData.visual) {
    // glTF: pitch back away from player
    z.mesh.userData.visual.rotation.x = strength * 0.32;
  }
}

function clearAttackPoseExtras(z) {
  if (z.mesh.userData.visual) {
    z.mesh.userData.visual.rotation.x = 0;
  }
}

export class ZombieManager {
  constructor(scene, colliders, assets = null) {
    this.scene = scene;
    this.colliders = colliders;
    this.assets = assets;
    this.zombies = [];
    this.hitMeshes = [];
    this.attackFx = [];
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
    this.clearAttackFx();
  }

  clearAttackFx() {
    for (const fx of this.attackFx) disposeFxItem(this.scene, fx);
    this.attackFx.length = 0;
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
      attackPose: 0,
      stagger: 0,
      staggerDirX: 0,
      staggerDirZ: 0,
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

  damageZombie(zombie, amount, fromPos = null) {
    if (!zombie || !zombie.alive) return false;
    zombie.hp -= amount;
    zombie.hitFlash = 0.15;
    applyHitFlash(zombie.mesh);
    if (zombie.hp > 0) {
      zombie.stagger = STAGGER_TIME;
      if (fromPos) {
        const dx = zombie.mesh.position.x - fromPos.x;
        const dz = zombie.mesh.position.z - fromPos.z;
        const len = Math.hypot(dx, dz) || 1;
        zombie.staggerDirX = dx / len;
        zombie.staggerDirZ = dz / len;
      }
    }
    if (zombie.hp <= 0) {
      zombie.alive = false;
      zombie.stagger = 0;
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

      if (z.stagger > 0) {
        z.stagger -= dt;
        const sx = z.staggerDirX || -nx;
        const sz = z.staggerDirZ || -nz;
        z.mesh.position.x += sx * STAGGER_SPEED * dt;
        z.mesh.position.z += sz * STAGGER_SPEED * dt;
        resolveCollision(z.mesh.position, ZOMBIE_RADIUS, this.colliders);
        z.mesh.position.y = 0;
      } else {
        z.mesh.position.x += nx * z.speed * dt;
        z.mesh.position.z += nz * z.speed * dt;
        resolveCollision(z.mesh.position, ZOMBIE_RADIUS, this.colliders);
        z.mesh.position.y = 0;
      }

      z.mesh.rotation.y = Math.atan2(nx, nz);

      z.bob += dt * (4 + z.speed);
      if (z.attackPose > 0) z.attackPose -= dt;

      const staggering = z.stagger > 0;
      const staggerStrength = staggering
        ? Math.min(1, z.stagger / STAGGER_TIME)
        : 0;

      if (z.mixer) {
        z.mixer.update(dt);
        if (staggering) {
          applyStaggerPose(z, staggerStrength);
        } else if (z.attackPose > 0) {
          const strength = Math.min(1, z.attackPose / (ATTACK_POSE_TIME * 0.55));
          applyAttackPose(z, strength);
        } else {
          clearAttackPoseExtras(z);
        }
      } else {
        const swing = Math.sin(z.bob) * 0.35;
        const { armL, armR, legL, legR } = z.mesh.userData;
        if (armL || armR || legL || legR) {
          if (staggering) {
            applyStaggerPose(z, staggerStrength);
          } else if (z.attackPose > 0) {
            const strength = Math.min(1, z.attackPose / (ATTACK_POSE_TIME * 0.55));
            applyAttackPose(z, strength);
          } else {
            if (armL) {
              armL.rotation.x = -0.5 + swing;
              armL.rotation.z = 0.35;
            }
            if (armR) {
              armR.rotation.x = -0.55 - swing;
              armR.rotation.z = -0.35;
            }
          }
          if (legL) legL.rotation.x = swing * 0.6;
          if (legR) legR.rotation.x = -swing * 0.6;
        } else if (z.mesh.userData.visual) {
          z.mesh.userData.visual.position.y =
            z.visualBaseY + Math.sin(z.bob) * 0.03;
          if (staggering) {
            applyStaggerPose(z, staggerStrength);
          } else if (z.attackPose > 0) {
            const strength = Math.min(1, z.attackPose / (ATTACK_POSE_TIME * 0.55));
            applyAttackPose(z, strength);
          } else {
            clearAttackPoseExtras(z);
          }
        }
      }

      if (z.contactCd > 0) z.contactCd -= dt;
      if (dist < CONTACT_RANGE && z.contactCd <= 0) {
        z.contactCd = CONTACT_COOLDOWN;
        z.attackPose = ATTACK_POSE_TIME;
        spawnClawBurst(this.scene, this.attackFx, playerPos, z.mesh.position);
        if (onContact) onContact(CONTACT_DAMAGE);
      }
    }

    this._updateAttackFx(dt);
  }

  _updateAttackFx(dt) {
    for (let i = this.attackFx.length - 1; i >= 0; i--) {
      const fx = this.attackFx[i];
      fx.life -= dt;
      if (fx.kind === 'blood') {
        fx.vel.y -= 14 * dt;
        fx.mesh.position.addScaledVector(fx.vel, dt);
      } else {
        // slash: drift slightly + fade
        fx.mesh.position.addScaledVector(fx.vel, dt * 0.35);
        fx.mesh.scale.x = 1 + (1 - fx.life / fx.maxLife) * 0.6;
      }
      const mat = fx.mesh.material;
      if (mat && mat.opacity != null) {
        mat.opacity = Math.max(0, (fx.life / fx.maxLife) * 0.95);
      }
      if (fx.life <= 0) {
        disposeFxItem(this.scene, fx);
        this.attackFx.splice(i, 1);
      }
    }
  }

  /** Drop position of dead zombies that need loot (caller tracks). */
  getMeshesForRaycast() {
    return this.hitMeshes;
  }
}
