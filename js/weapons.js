import * as THREE from 'three';

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

export class Weapons {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
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
    this.mouseDown = false;
    this.muzzleLight = new THREE.PointLight(0xffaa55, 0, 8, 2);
    this.scene.add(this.muzzleLight);
    this.muzzleFlashTime = 0;
    this.sparks = [];
    this._onDown = (e) => { if (e.button === 0) this.mouseDown = true; };
    this._onUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onKey = (e) => {
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') this.current = 'pistol';
      if (e.code === 'Digit2' && this.hasSmg) this.current = 'smg';
    };
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('mouseup', this._onUp);
    document.addEventListener('keydown', this._onKey);

    // Simple gun model attached to camera
    this.gunGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x222528, metalness: 0.7, roughness: 0.35 })
    );
    body.position.set(0.18, -0.16, -0.35);
    this.gunGroup.add(body);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.85, roughness: 0.3 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.18, -0.13, -0.52);
    this.gunGroup.add(barrel);
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);
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
  }

  startReload() {
    if (this.reloading || !this.aliveCheck) return;
    const s = this.ammoState;
    const def = this.def;
    if (s.mag >= def.magSize || s.reserve <= 0) return;
    this.reloading = true;
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
    this.mouseDown = false;
    this.muzzleFlashTime = 0;
    this.clearSparks();
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
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    for (let i = 0; i < 6; i++) {
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

    // Gun bob
    this.gunGroup.position.y = Math.sin(performance.now() * 0.008) * 0.004;

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
