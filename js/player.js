import * as THREE from 'three';
import { resolveCollision } from './world.js';

const EYE_HEIGHT = 1.7;
const MOVE_SPEED = 6.5;
const SPRINT_MULT = 1.55;
const MOUSE_SENS = 0.0022;
const PLAYER_RADIUS = 0.4;
const MAX_HP = 100;

export class Player {
  constructor(camera, canvas, colliders) {
    this.camera = camera;
    this.canvas = canvas;
    this.colliders = colliders;
    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 8);
    this.velocity = new THREE.Vector3();
    this.keys = Object.create(null);
    this.locked = false;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.alive = true;
    this.damageFlash = 0;
    this.hurtShake = 0;
    this._onKeyDown = (e) => { this.keys[e.code] = true; };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
    };
    this._bind();
    this.syncCamera();
  }

  _bind() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }

  requestLock() {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  onMouseMove(e) {
    if (!this.locked || !this.alive) return;
    this.yaw -= e.movementX * MOUSE_SENS;
    this.pitch -= e.movementY * MOUSE_SENS;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
  }

  syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    const hs = Math.min(1, this.hurtShake);
    this.camera.rotation.z = Math.sin(performance.now() * 0.045) * 0.045 * hs;
    this.camera.rotation.x = this.pitch + Math.sin(performance.now() * 0.06) * 0.025 * hs;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 1;
    this.hurtShake = 1;
    if (this.hp <= 0) {
      this.alive = false;
      this.hp = 0;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  reset() {
    this.hp = MAX_HP;
    this.alive = true;
    this.yaw = 0;
    this.pitch = 0;
    this.position.set(0, EYE_HEIGHT, 8);
    this.velocity.set(0, 0, 0);
    this.damageFlash = 0;
    this.hurtShake = 0;
    this.keys = Object.create(null);
    this.syncCamera();
  }

  update(dt) {
    if (!this.alive) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
      this.hurtShake = Math.max(0, this.hurtShake - dt * 3.2);
      return;
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys['KeyW']) wish.add(forward);
    if (this.keys['KeyS']) wish.sub(forward);
    if (this.keys['KeyA']) wish.sub(right);
    if (this.keys['KeyD']) wish.add(right);

    if (wish.lengthSq() > 0) {
      wish.normalize();
      const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1);
      this.position.x += wish.x * speed * dt;
      this.position.z += wish.z * speed * dt;
    }

    resolveCollision(this.position, PLAYER_RADIUS, this.colliders);
    this.position.y = EYE_HEIGHT;
    this.syncCamera();

    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    this.hurtShake = Math.max(0, this.hurtShake - dt * 3.2);
  }

  getAimRay() {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin, dir };
  }
}
