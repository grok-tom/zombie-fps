import * as THREE from 'three';
import { clonePistol } from './assets.js';

const WEAPONS = {
  pistol: {
    name: '手枪',
    damage: 28,
    fireRate: 3.2,
    magSize: 12,
    reserveStart: 48,
    reloadTime: 1.35,
    spread: 0.012,
    auto: false,
  },
  smg: {
    name: '冲锋枪',
    damage: 14,
    fireRate: 11,
    magSize: 30,
    reserveStart: 90,
    reloadTime: 1.7,
    spread: 0.028,
    auto: true,
  },
};

const VIEW_POS = new THREE.Vector3(0.22, -0.22, -0.45);
const PISTOL_LENGTH = 0.42;
const SMG_LENGTH = 0.5;

function fitViewmodel(root, targetLength) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z, 0.01);
  const s = targetLength / longest;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  root.position.sub(center);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.frustumCulled = false;
    }
  });
}

function createFallbackGunParts(group) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x222528, metalness: 0.7, roughness: 0.35 })
  );
  body.position.set(0, 0, 0);
  group.add(body);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.85, roughness: 0.3 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.2);
  group.add(barrel);
}

export class Weapons {
  constructor(scene, camera, assets = null) {
    this.scene = scene;
    this.camera = camera;
    this.assets = assets;
    this.raycaster = new THREE.Raycaster();
    this.current = 'pistol';
    this.hasSmg = false;
    this.state = {
      pistol: { mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserveStart },
      smg: { mag: 0, reserve: 0 },
    };
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.mouseDown = false;
    this.muzzleLight = new THREE.PointLight(0xffaa55, 0, 8, 2);
    this.scene.add(this.muzzleLight);
    this.muzzleFlashTime = 0;
    this.recoil = 0;
    this._hurtShakeFn = null;
    this.sparks = [];
    this._pistolMesh = null;
    this._smgMesh = null;
    this._onDown = (e) => { if (e.button === 0) this.mouseDown = true; };
    this._onUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onKey = (e) => {
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') {
        this.current = 'pistol';
        this._syncViewmodel();
      }
      if (e.code === 'Digit2' && this.hasSmg) {
        this.current = 'smg';
        this._syncViewmodel();
      }
    };
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('mouseup', this._onUp);
    document.addEventListener('keydown', this._onKey);

    this.gunGroup = new THREE.Group();
    let pistol = null;
    try {
      pistol = assets ? clonePistol(assets) : null;
    } catch (e) {
      console.warn('clonePistol failed, using box fallback', e);
      pistol = null;
    }

    if (pistol) {
      // Kenney blasters typically face +Z; rotate so barrel aims camera-forward (-Z)
      pistol.rotation.y = Math.PI;
      fitViewmodel(pistol, PISTOL_LENGTH);
      this.gunGroup.add(pistol);
      this._pistolMesh = pistol;

      if (assets && assets.smgPrototype) {
        try {
          const smg = assets.smgPrototype.clone(true);
          smg.rotation.y = Math.PI;
          fitViewmodel(smg, SMG_LENGTH);
          smg.visible = false;
          this.gunGroup.add(smg);
          this._smgMesh = smg;
        } catch (e) {
          console.warn('smg clone failed', e);
        }
      }
    } else {
      createFallbackGunParts(this.gunGroup);
    }

    this.gunGroup.position.copy(VIEW_POS);
    this.gunGroup.rotation.set(0, 0, 0);
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);
    this._syncViewmodel();
  }

  _applyRestGunPose(bobY = 0) {
    this.gunGroup.position.set(VIEW_POS.x, VIEW_POS.y + bobY, VIEW_POS.z);
    this.gunGroup.rotation.set(0, 0, 0);
  }

  _applyReloadGunPose(progress) {
    // progress 0..1 over full reloadTime; dip + roll then ease back (sin envelope)
    const env = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
    const eased = env * env; // slightly snappier mid dip
    const mix = env * 0.65 + eased * 0.35;
    this.gunGroup.position.x = VIEW_POS.x + mix * 0.04;
    this.gunGroup.position.y = VIEW_POS.y - mix * 0.2;
    this.gunGroup.position.z = VIEW_POS.z + mix * 0.1;
    this.gunGroup.rotation.x = mix * 0.35;
    this.gunGroup.rotation.y = mix * -0.08;
    this.gunGroup.rotation.z = mix * 0.55;
  }

  setHurtShake(fn) {
    this._hurtShakeFn = fn;
  }

  _kickRecoil() {
    const auto = this.def.auto;
    this.recoil = Math.min(1, this.recoil + (auto ? 0.55 : 1));
  }

  _applyCombatGunPose(bobY, recoil, hurt) {
    const r = Math.min(1, Math.max(0, recoil));
    const h = Math.min(1, Math.max(0, hurt));
    const kickZ = r * (this.def.auto ? 0.06 : 0.11);
    const kickY = r * (this.def.auto ? 0.02 : 0.045);
    const kickPitch = r * (this.def.auto ? 0.08 : 0.18);
    this.gunGroup.position.set(
      VIEW_POS.x + h * 0.035,
      VIEW_POS.y + bobY + kickY,
      VIEW_POS.z + kickZ
    );
    this.gunGroup.rotation.set(kickPitch, h * -0.06, h * 0.12);
  }

  _syncViewmodel() {
    if (!this._pistolMesh) return;
    const showSmg = this.current === 'smg' && this._smgMesh;
    this._pistolMesh.visible = !showSmg;
    if (this._smgMesh) this._smgMesh.visible = !!showSmg;
  }

  dispose() {
    document.removeEventListener('mousedown', this._onDown);
    document.removeEventListener('mouseup', this._onUp);
    document.removeEventListener('keydown', this._onKey);
  }

  get def() {
    return WEAPONS[this.current];
  }

  get ammoState() {
    return this.state[this.current];
  }

  ammoLabel() {
    const s = this.ammoState;
    const reload = this.reloading ? ' 换弹…' : '';
    return `${s.mag} / ${s.reserve}${reload}`;
  }

  pickupAmmo(amount = 24) {
    if (this.hasSmg && this.current === 'smg') {
      this.state.smg.reserve += amount;
    } else {
      this.state.pistol.reserve += Math.floor(amount * 0.75);
      if (this.hasSmg) this.state.smg.reserve += amount;
      else this.state.pistol.reserve += Math.floor(amount * 0.25);
    }
  }

  pickupSmg() {
    this.hasSmg = true;
    this.state.smg.mag = WEAPONS.smg.magSize;
    this.state.smg.reserve = WEAPONS.smg.reserveStart;
    this.current = 'smg';
    this._syncViewmodel();
  }

  startReload() {
    if (this.reloading || !this.aliveCheck) return;
    const s = this.ammoState;
    const def = this.def;
    if (s.mag >= def.magSize || s.reserve <= 0) return;
    this.reloading = true;
    this.reloadDuration = def.reloadTime;
    this.reloadTimer = def.reloadTime;
  }

  set aliveCheck(v) { this._alive = v; }
  get aliveCheck() { return this._alive !== false; }

  reset() {
    this.current = 'pistol';
    this.hasSmg = false;
    this.state = {
      pistol: { mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserveStart },
      smg: { mag: 0, reserve: 0 },
    };
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.mouseDown = false;
    this.muzzleFlashTime = 0;
    this.recoil = 0;
    this.clearSparks();
    this._applyRestGunPose(0);
    this._syncViewmodel();
  }

  clearSparks() {
    for (const sp of this.sparks) {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      sp.mesh.material.dispose();
    }
    this.sparks.length = 0;
  }

  spawnSparks(point, normal) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    for (let i = 0; i < 6; i++) {
      // Unique geometry per spark so dispose in clearSparks / life expiry is safe
      const geo = new THREE.SphereGeometry(0.04, 6, 6);
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.position.copy(point);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
      if (normal) vel.addScaledVector(normal, 2);
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel, life: 0.35 + Math.random() * 0.2 });
    }
  }

  /**
   * Attempt fire. Returns hit info { point, object, distance } or null / { dry: true }.
   * zombieMeshes: array of Object3D to test.
   */
  tryFire(dt, locked, zombieMeshes, onShot, onDry) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const s = this.ammoState;
        const def = this.def;
        const need = def.magSize - s.mag;
        const take = Math.min(need, s.reserve);
        s.mag += take;
        s.reserve -= take;
        this.reloading = false;
        this.reloadTimer = 0;
        this.reloadDuration = 0;
        this._applyRestGunPose(0);
      }
    }

    // Update muzzle / sparks
    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= dt;
      this.muzzleLight.intensity = Math.max(0, this.muzzleFlashTime * 40);
    } else {
      this.muzzleLight.intensity = 0;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life -= dt;
      sp.vel.y -= 12 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        sp.mesh.material.dispose();
        this.sparks.splice(i, 1);
      }
    }

    // Viewmodel: reload overrides recoil; else bob + recoil + hurt flinch
    if (this.reloading && this.reloadDuration > 0) {
      const progress = 1 - (this.reloadTimer / this.reloadDuration);
      this._applyReloadGunPose(progress);
    } else {
      const bobY = Math.sin(performance.now() * 0.008) * 0.004;
      const hurt = this._hurtShakeFn ? this._hurtShakeFn() : 0;
      this._applyCombatGunPose(bobY, this.recoil, hurt);
      this.recoil = Math.max(0, this.recoil - dt * (this.def.auto ? 10 : 7));
    }

    if (!locked || !this.aliveCheck) return null;
    if (!this.mouseDown) return null;

    const def = this.def;
    if (!def.auto && this._firedSemi) return null;
    if (this.cooldown > 0) return null;
    if (this.reloading) return null;

    const s = this.ammoState;
    if (s.mag <= 0) {
      if (s.reserve > 0) this.startReload();
      else if (onDry) onDry();
      this._firedSemi = true;
      this.cooldown = 0.2;
      return { dry: true };
    }

    s.mag -= 1;
    this.cooldown = 1 / def.fireRate;
    this._firedSemi = true;
    if (!def.auto) this.mouseDown = this.mouseDown; // keep; block via _firedSemi until up

    // Muzzle flash at camera-forward
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.x += (Math.random() - 0.5) * def.spread;
    dir.y += (Math.random() - 0.5) * def.spread;
    dir.z += (Math.random() - 0.5) * def.spread;
    dir.normalize();

    this.muzzleLight.position.copy(origin).addScaledVector(dir, 0.6);
    this.muzzleFlashTime = 0.05;
    this.muzzleLight.intensity = 2.5;
    this._kickRecoil();

    if (onShot) onShot();

    this.raycaster.set(origin, dir);
    this.raycaster.far = 80;
    const hits = this.raycaster.intersectObjects(zombieMeshes, true);
    if (hits.length > 0) {
      const hit = hits[0];
      this.spawnSparks(hit.point, hit.face ? hit.face.normal : null);
      return {
        point: hit.point.clone(),
        object: hit.object,
        distance: hit.distance,
        damage: def.damage,
      };
    }
    // World miss spark far away optional — skip
    return { miss: true, damage: def.damage };
  }

  noteMouseUp() {
    this._firedSemi = false;
  }

  updateSemiReset() {
    if (!this.mouseDown) this._firedSemi = false;
  }
}

export { WEAPONS };
