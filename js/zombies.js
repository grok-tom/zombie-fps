import * as THREE from 'three';
import { resolveCollision } from './world.js';

const ZOMBIE_RADIUS = 0.45;
const CONTACT_RANGE = 1.35;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN = 0.85;

function createZombieMesh() {
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

export class ZombieManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.zombies = [];
    this.hitMeshes = [];
  }

  clear() {
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies.length = 0;
    this.hitMeshes.length = 0;
  }

  spawn(position, { hp = 60, speed = 2.2 } = {}) {
    const mesh = createZombieMesh();
    mesh.position.set(position.x, 0, position.z);
    this.scene.add(mesh);
    const zombie = {
      mesh,
      hp,
      maxHp: hp,
      speed,
      alive: true,
      contactCd: 0,
      bob: Math.random() * Math.PI * 2,
      hitFlash: 0,
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
    // Tint flash
    zombie.mesh.traverse((c) => {
      if (c.isMesh && c.material && c.material.emissive) {
        c.material._savedEmissive = c.material.emissive.getHex();
        c.material.emissive.setHex(0xffffff);
        c.material.emissiveIntensity = 0.8;
      }
    });
    if (zombie.hp <= 0) {
      zombie.alive = false;
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
          z.mesh.traverse((c) => {
            if (c.isMesh && c.material && c.material.emissive && c.material._savedEmissive != null) {
              c.material.emissive.setHex(c.material.color ? 0x000000 : 0);
              // restore eye glow only for small spheres — simpler: reset non-eye
              if (c.geometry && c.geometry.type === 'SphereGeometry') {
                c.material.emissive.setHex(0xff1100);
                c.material.emissiveIntensity = 2.2;
              } else {
                c.material.emissive.setHex(0x000000);
                c.material.emissiveIntensity = 0;
              }
            }
          });
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

      // Shambling animation
      z.bob += dt * (4 + z.speed);
      const swing = Math.sin(z.bob) * 0.35;
      const { armL, armR, legL, legR } = z.mesh.userData;
      if (armL) armL.rotation.x = -0.5 + swing;
      if (armR) armR.rotation.x = -0.55 - swing;
      if (legL) legL.rotation.x = swing * 0.6;
      if (legR) legR.rotation.x = -swing * 0.6;

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
