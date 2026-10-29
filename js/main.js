import * as THREE from 'three';
import { createWorld } from './world.js';
import { loadGameAssets } from './assets.js';
import { Player } from './player.js';
import { Weapons } from './weapons.js';
import { ZombieManager } from './zombies.js';
import { WaveDirector } from './waves.js';
import { UI } from './ui.js';
import { AudioBus } from './audio.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 120);

const assets = await loadGameAssets();
const world = createWorld(scene, assets);
const player = new Player(camera, canvas, world.colliders);
const weapons = new Weapons(scene, camera);
weapons.aliveCheck = true;
const zombies = new ZombieManager(scene, world.colliders);
const ui = new UI();
const audio = new AudioBus();

/** @type {{ mesh: THREE.Object3D, type: string, bob: number }[]} */
const pickups = [];

const waves = new WaveDirector({
  spawnPoints: world.spawnPoints,
  onWaveStart(n) {
    ui.flashBanner(`第 ${n} 波`, 2.4);
    audio.roar();
    // Intermission loot every wave start after 1
    if (n > 1) {
      maybeSpawnPickup('ammo', player.position);
      if (Math.random() < 0.55) maybeSpawnPickup('medkit', player.position);
    }
    if (n === 2 && !weapons.hasSmg) {
      spawnPickupAt(new THREE.Vector3(2, 0, 0), 'smg');
    }
  },
  onSpawn(pos, stats) {
    zombies.spawn(pos, stats);
  },
});

let state = 'menu'; // menu | play | dead
let smgOffered = false;

ui.showMenu();

function spawnPickupAt(pos, type) {
  const group = new THREE.Group();
  let color = 0xffe08a;
  let emissive = 0xaa8800;
  if (type === 'medkit') { color = 0xff6b6b; emissive = 0xaa2222; }
  if (type === 'smg') { color = 0x7ec8ff; emissive = 0x2266aa; }

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.35, 0.45),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.4 })
  );
  box.position.y = 0.35;
  group.add(box);

  const light = new THREE.PointLight(color, 0.8, 5);
  light.position.y = 0.6;
  group.add(light);

  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  pickups.push({ mesh: group, type, bob: Math.random() * Math.PI * 2 });
}

function maybeSpawnPickup(type, near) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 3 + Math.random() * 5;
  const p = new THREE.Vector3(
    near.x + Math.cos(angle) * dist,
    0,
    near.z + Math.sin(angle) * dist
  );
  p.x = Math.max(-30, Math.min(30, p.x));
  p.z = Math.max(-30, Math.min(30, p.z));
  spawnPickupAt(p, type);
}

function clearPickups() {
  for (const p of pickups) scene.remove(p.mesh);
  pickups.length = 0;
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.bob += dt * 3;
    p.mesh.position.y = Math.sin(p.bob) * 0.12;
    p.mesh.rotation.y += dt * 1.5;

    const dx = p.mesh.position.x - player.position.x;
    const dz = p.mesh.position.z - player.position.z;
    if (dx * dx + dz * dz < 1.6 * 1.6) {
      if (p.type === 'ammo') {
        weapons.pickupAmmo(30);
        ui.flashBanner('弹药补给', 1.2);
      } else if (p.type === 'medkit') {
        player.heal(40);
        ui.flashBanner('医疗包 +40', 1.2);
      } else if (p.type === 'smg') {
        weapons.pickupSmg();
        smgOffered = true;
        ui.flashBanner('获得冲锋枪！', 2);
      }
      audio.pickup();
      scene.remove(p.mesh);
      pickups.splice(i, 1);
    }
  }
}

function startGame() {
  zombies.clear();
  clearPickups();
  player.reset();
  weapons.reset();
  weapons.aliveCheck = true;
  waves.reset();
  smgOffered = false;
  state = 'play';
  ui.hideOverlay();
  player.requestLock();
  audio.ensure();
  waves.start();
  // Starter ammo crate nearby
  spawnPickupAt(new THREE.Vector3(-3, 0, 5), 'ammo');
}

function onDeath() {
  state = 'dead';
  weapons.aliveCheck = false;
  ui.showDeath(waves.kills, waves.wave);
}

function onPointerDown() {
  if (state === 'menu' || state === 'dead') {
    startGame();
  } else if (state === 'play' && !player.locked) {
    player.requestLock();
  }
}
canvas.addEventListener('click', onPointerDown);
document.getElementById('overlay').addEventListener('click', onPointerDown);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === 'play') {
    player.update(dt);
    weapons.updateSemiReset();

    if (!player.alive) {
      onDeath();
    } else {
      const hit = weapons.tryFire(
        dt,
        player.locked,
        zombies.getMeshesForRaycast(),
        () => audio.shot(),
        () => audio.dry()
      );
      if (hit && hit.object) {
        const z = zombies.findByObject(hit.object);
        if (z) {
          const died = zombies.damageZombie(z, hit.damage);
          audio.hit();
          if (died) {
            waves.onKill();
            // Drop chance
            if (Math.random() < 0.22) {
              const t = Math.random() < 0.35 ? 'medkit' : 'ammo';
              spawnPickupAt(z.mesh.position.clone(), t);
            }
          }
        }
      }

      zombies.update(dt, player.position, (dmg) => {
        player.takeDamage(dmg);
        audio.hurt();
      });
      waves.update(dt, zombies.aliveCount());
      updatePickups(dt);
    }
  }

  ui.updateBanner(dt);
  ui.update({
    hp: player.hp,
    ammo: weapons.ammoLabel(),
    wave: Math.max(1, waves.wave),
    kills: waves.kills,
    damageFlash: player.damageFlash,
  });

  // Subtle lamp flicker
  for (const L of world.lampLights) {
    L.intensity = 6 + Math.sin(now * 0.004 + L.position.x) * 0.45;
  }

  renderer.render(scene, camera);
  window.__ZFPS = { player, zombies, waves, weapons, get aliveZ() { return zombies.aliveCount(); } };
requestAnimationFrame(frame);
}
window.__ZFPS = { player, zombies, waves, weapons, get aliveZ() { return zombies.aliveCount(); } };
requestAnimationFrame(frame);
