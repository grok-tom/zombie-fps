# Cinematic Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace box-primitive night street visuals with demake-quality free glTF city/zombie/gun assets, cinematic lighting/fog, and light post-processing, without changing gameplay numbers.

**Architecture:** Vendor CC0/CC-BY glTF under `assets/`. Add `js/assets.js` (GLTFLoader helpers + prototype clones). Rewrite `createWorld` to assemble modular buildings + PBR ground, keep AABB `colliders` / `spawnPoints` / `lampLights` API. Swap zombie/gun meshes via prototypes. Add `js/postfx.js` EffectComposer (RenderPass + mild UnrealBloom + vignette). `main.js` becomes async boot: load assets → create world → start loop; render through composer.

**Tech Stack:** Three.js r160 (existing CDN import map), `three/addons/loaders/GLTFLoader.js`, `three/addons/postprocessing/*`, local static server, free Kenney / Quaternius (or equivalent CC0) GLBs.

## Global Constraints

- Gameplay: wave/ammo/damage/reload numbers unchanged unless collider size forces spawn tweaks.
- Licenses: only CC0 / CC-BY / clear free-commercial; document every file in `assets/CREDITS.md`.
- Vendor locally under `assets/` — no hotlink-only models.
- Fallback: if a GLB fails, textured primitives still boot playable.
- Target ≥30fps desktop Chrome ~1280×800; shadow map ≤1024; ≤6 warm point lights.
- Keep exports: `createWorld(scene)` → `{ colliders, spawnPoints, lampLights }`; `resolveCollision`; `ZombieManager` / `Weapons` public methods used by `main.js`.
- UI language remains Chinese.

---

### Task 1: Vendor assets + CREDITS

**Files:**
- Create: `assets/CREDITS.md`
- Create: `assets/city/` (building / prop GLBs)
- Create: `assets/characters/zombie.glb` (or pack subset)
- Create: `assets/weapons/pistol.glb` (and optional `smg.glb`)
- Create: `assets/textures/` (optional asphalt/concrete if city pack lacks ground)
- Test: shell existence checks

**Interfaces:**
- Produces: files at paths below, referenced by later tasks exactly:
  - `assets/city/building-*.glb` (at least 3 variants) OR one `assets/city/block.glb`
  - `assets/characters/zombie.glb`
  - `assets/weapons/pistol.glb`
  - `assets/CREDITS.md`

- [ ] **Step 1: Create asset folders**

```bash
mkdir -p /workspace/zombie-fps/assets/{city,characters,weapons,textures}
```

- [ ] **Step 2: Download CC0 packs (preferred sources)**

Prefer in order (stop when you have usable GLB/glTF):

1. **City modules:** Kenney City Kit (Suburban or Commercial) from https://kenney.nl — download ZIP, copy several building `.glb`/`.gltf` into `assets/city/`. If only FBX/OBJ, convert with Blender CLI already on box (`blender --background --python` export glTF) or pick another CC0 glTF city pack from poly.pizza / Quaternius.
2. **Zombie:** Quaternius “Animated Zombie” / “Ultimate Zombie” CC0 glTF, or Kenney character zombie — save as `assets/characters/zombie.glb`.
3. **Pistol:** Kenney Weapon Pack pistol glTF → `assets/weapons/pistol.glb`. Optional SMG → `assets/weapons/smg.glb`.

Example pattern (adjust URLs to the actual CDN/release you verify with `curl -I`):

```bash
cd /tmp
# After downloading and unzipping a verified CC0 pack:
# cp path/to/buildings/*.glb /workspace/zombie-fps/assets/city/
# cp path/to/zombie.glb /workspace/zombie-fps/assets/characters/zombie.glb
# cp path/to/pistol.glb /workspace/zombie-fps/assets/weapons/pistol.glb
ls -la /workspace/zombie-fps/assets/city/ /workspace/zombie-fps/assets/characters/ /workspace/zombie-fps/assets/weapons/
```

If no suitable city GLB exists after 20 minutes: generate `assets/textures/asphalt.png` (512×512 noise) with ImageMagick/Python and proceed with textured box buildings (fallback path in Task 3) — still write CREDITS noting procedural textures.

- [ ] **Step 3: Write CREDITS**

Create `assets/CREDITS.md` listing for each file: name, author, license, source URL.

- [ ] **Step 4: Verify files exist**

```bash
test -f /workspace/zombie-fps/assets/CREDITS.md
test -f /workspace/zombie-fps/assets/characters/zombie.glb
test -f /workspace/zombie-fps/assets/weapons/pistol.glb
ls /workspace/zombie-fps/assets/city/ | head
```

Expected: exit 0; city dir non-empty OR document fallback in CREDITS.

- [ ] **Step 5: Commit**

```bash
cd /workspace/zombie-fps
git add assets/
git commit -m "assets: vendor CC0 city, zombie, and pistol glTFs"
```

---

### Task 2: Asset loader module

**Files:**
- Create: `js/assets.js`
- Modify: `index.html` (optional loading text only if needed in Task 6)
- Test: load via static server + node-less browser console, or small html smoke

**Interfaces:**
- Produces:
  - `export async function loadGameAssets() → Promise<GameAssets>`
  - `GameAssets` shape:
    ```js
    {
      buildings: THREE.Object3D[], // cloned-ready roots
      zombiePrototype: THREE.Object3D,
      zombieClips: THREE.AnimationClip[], // may be []
      pistolPrototype: THREE.Object3D,
      smgPrototype: THREE.Object3D | null,
      ready: true
    }
    ```
  - `export function cloneZombie(assets) → THREE.Object3D`
  - `export function clonePistol(assets) → THREE.Object3D`
- Consumes: files from Task 1

- [ ] **Step 1: Implement `js/assets.js`**

```js
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
  // List concrete filenames present after Task 1 — update array to match disk:
  const buildingFiles = [
    'assets/city/building-a.glb',
    'assets/city/building-b.glb',
    'assets/city/building-c.glb',
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
```

Update `buildingFiles` to the real filenames from Task 1.

- [ ] **Step 2: Smoke-load with static server**

```bash
cd /workspace/zombie-fps && python3 -m http.server 8765
# In another shell / browser console on http://127.0.0.1:8765/ :
# import { loadGameAssets } from './js/assets.js'; const a = await loadGameAssets(); console.log(a.buildings.length, !!a.zombiePrototype, !!a.pistolPrototype);
```

Expected: `buildings.length >= 1` (or 0 if fallback city), zombie and pistol true when files exist; no uncaught exception.

- [ ] **Step 3: Commit**

```bash
git add js/assets.js
git commit -m "feat: GLTF asset loader for city, zombie, weapons"
```

---

### Task 3: Rebuild world assembly + lighting/fog

**Files:**
- Modify: `js/world.js` (replace mesh construction; keep `resolveCollision` API)
- Modify: `js/main.js` (pass `assets` into `createWorld`; remove duplicate AmbientLight if world owns lighting; lower exposure later in Task 5)

**Interfaces:**
- Consumes: `GameAssets` from Task 2
- Produces: `export function createWorld(scene, assets = null) → { colliders, spawnPoints, lampLights }`
  - Same collider AABB shape: `{ minX, maxX, minZ, maxZ, minY, maxY }`
  - `lampLights: THREE.PointLight[]`
  - Background `#1a2230`, fog `FogExp2(0x1a2230, ~0.012–0.018)` (tune for readability)
  - Hemisphere + cool Directional moon (`castShadow` true, mapSize 1024, camera near/far tight) + warm lamp points

- [ ] **Step 1: Change signature and lighting block at top of `createWorld`**

Replace background/fog/lights section with cinematic night values:

```js
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
  scene.add(moon);
  // ... ground + buildings ...
}
```

- [ ] **Step 2: Place buildings from `assets.buildings` or textured fallback**

Keep approximately the same footprint list as current `buildings` array. For each footprint:

```js
function placeBuilding(scene, assets, b, colliders) {
  let root;
  if (assets && assets.buildings.length) {
    const proto = assets.buildings[Math.floor(Math.random() * assets.buildings.length)];
    root = proto.clone(true);
    // Normalize: fit XZ to b.w x b.d, feet on y=0
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sx = b.w / Math.max(size.x, 0.01);
    const sz = b.d / Math.max(size.z, 0.01);
    const s = Math.min(sx, sz);
    root.scale.multiplyScalar(s);
    root.position.set(b.x, -box.min.y * s, b.z);
  } else {
    // textured box fallback (MeshStandardMaterial with assets/textures/asphalt.png or color 0x6a7384)
    root = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({ color: 0x6a7384, roughness: 0.9 })
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
```

Ground: larger plane with repeating asphalt texture if available; `receiveShadow = true`.

- [ ] **Step 3: Keep lamp posts + `lampLights` array** (warm `0xffc070`, intensity ~4–8, distance ~18–28, decay 2). Align positions with street.

- [ ] **Step 4: Keep `spawnPoints` and `resolveCollision` unchanged in behavior.**

- [ ] **Step 5: Wire `main.js` async boot**

```js
import { loadGameAssets } from './assets.js';
// ...
const assets = await loadGameAssets();
const world = createWorld(scene, assets);
// remove scene.add(new THREE.AmbientLight(...)) if world lighting is enough
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMappingExposure = 1.15; // was 2.1; retune after look
```

Note: `main.js` must become top-level await capable (already `type="module"`).

- [ ] **Step 6: Visual verify**

Open `http://127.0.0.1:8765/`, screenshot menu/play: buildings not flat grey boxes (or clearly textured fallback); fog/moon visible.

- [ ] **Step 7: Commit**

```bash
git add js/world.js js/main.js
git commit -m "feat: cinematic world assembly with glTF buildings and night lights"
```

---

### Task 4: Zombie glTF + hit flash

**Files:**
- Modify: `js/zombies.js`
- Modify: `js/main.js` (pass assets into `ZombieManager`)

**Interfaces:**
- Consumes: `cloneZombie(assets)`, `assets.zombieClips`
- Produces: `new ZombieManager(scene, colliders, assets)`
  - `spawn` / `update` / `getMeshesForRaycast` / `findByObject` / `damageZombie` unchanged signatures
  - Scale zombie so eye height ~1.7–1.9m; feet at y=0
  - If clips include walk: `AnimationMixer`; else keep procedural limb swing when `userData` limbs exist, else gentle bob only

- [ ] **Step 1: Constructor stores assets; `createZombieMesh(assets)` uses clone**

```js
function createZombieMesh(assets) {
  const cloned = assets ? cloneZombie(assets) : null;
  if (cloned) {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetH = 1.85;
    const s = targetH / Math.max(size.y, 0.01);
    cloned.scale.setScalar(s);
    cloned.position.y = -box.min.y * s;
    const wrap = new THREE.Group();
    wrap.add(cloned);
    wrap.userData.visual = cloned;
    return wrap;
  }
  // existing box zombie as fallback...
}
```

- [ ] **Step 2: Hit flash** — prefer multiplying mesh color / emissive briefly; do not assume SphereGeometry eyes.

```js
// on damage: traverse meshes, set material.emissive to 0xff6666 intensity 0.6; store previous
// on flash end: restore previous emissive hex + intensity from userData
```

- [ ] **Step 3: Animation** — if `zombieClips.length`, create mixer on spawn; in `update` call `mixer.update(dt)`. Prefer clip name matching `/walk|run|idle/i`.

- [ ] **Step 4: Play-test** — wave 1 zombies readable as humanoid within 5m; raycast kills still work (`findByObject` walks parents).

- [ ] **Step 5: Commit**

```bash
git add js/zombies.js js/main.js
git commit -m "feat: glTF zombie models with fallback primitives"
```

---

### Task 5: FPS pistol (and SMG) models

**Files:**
- Modify: `js/weapons.js`

**Interfaces:**
- Consumes: `clonePistol(assets)`, optional `assets.smgPrototype`
- Produces: `new Weapons(scene, camera, assets)`
  - Replace box gun with glTF parented to camera
  - Local transform approx: position `(0.22, -0.22, -0.45)`, scale so length ~0.35–0.5m in view
  - On `pickupSmg` / switch weapon: hide/show pistol vs smg meshes if smg asset exists; else keep pistol mesh for both
  - Muzzle light / tryFire math unchanged

- [ ] **Step 1: Build gun group from assets**

```js
constructor(scene, camera, assets = null) {
  // ... existing state ...
  this.gunGroup = new THREE.Group();
  const pistol = assets ? clonePistol(assets) : null;
  if (pistol) {
    pistol.rotation.y = Math.PI; // adjust after looking down gun; may need X/Z tweaks
    pistol.scale.setScalar(0.4); // tune
    pistol.position.set(0, 0, 0);
    this.gunGroup.add(pistol);
    this._pistolMesh = pistol;
  } else {
    // existing box+cylinder fallback
  }
  this.gunGroup.position.set(0.22, -0.22, -0.45);
  this.camera.add(this.gunGroup);
  this.scene.add(this.camera);
}
```

- [ ] **Step 2: Tune transform** until gun sits bottom-right, barrel roughly toward crosshair (screenshot).

- [ ] **Step 3: Commit**

```bash
git add js/weapons.js js/main.js
git commit -m "feat: first-person glTF pistol viewmodel"
```

---

### Task 6: Post-processing + renderer polish

**Files:**
- Create: `js/postfx.js`
- Modify: `js/main.js` (composer.render; resize updates composer size)
- Modify: `index.html` optional `#loading` hint

**Interfaces:**
- Produces: `export function createPostFX(renderer, scene, camera) → { composer, setSize(w,h), render() }`
  - Passes: RenderPass, UnrealBloomPass with `strength ≈ 0.25`, `radius ≈ 0.4`, `threshold ≈ 0.85`
  - Vignette: either ShaderPass with simple vignette shader OR rely on existing HUD `#vignette` for damage only and add always-on CSS radial dark edges on `#hud` — prefer ShaderPass for cinematic look
- Debug: `window.__ZFPS_FX = { bloom: true }` — if false, skip bloom pass strength 0

- [ ] **Step 1: Implement `js/postfx.js`**

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as THREE from 'three';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      color.rgb *= smoothstep(0.8, offset * 0.35, dist * (darkness + dist));
      gl_FragColor = color;
    }`,
};

export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.25, 0.4, 0.85
  );
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(VignetteShader));
  return {
    composer,
    bloom,
    setSize(w, h) {
      composer.setSize(w, h);
    },
    render() {
      composer.render();
    },
  };
}
```

- [ ] **Step 2: In `main.js` frame loop** replace `renderer.render(scene, camera)` with `postfx.render()`; on resize call `postfx.setSize`.

- [ ] **Step 3: Enable `renderer.shadowMap`; set exposure ~1.0–1.3`** so street is readable (not crushed black).

- [ ] **Step 4: Optional loading** — before await assets, set overlay hint to「加载场景资源…」; after load restore「点击画面开始」.

- [ ] **Step 5: Commit**

```bash
git add js/postfx.js js/main.js index.html
git commit -m "feat: bloom and vignette post-processing"
```

---

### Task 7: Acceptance pass (screenshots + short clip)

**Files:**
- Create: `demo-cinematic-menu.png`, `demo-cinematic-play.png`, `demo-cinematic-zombie.png` (overwrite or new names under `/workspace/zombie-fps/`)
- Modify: `README.md` one paragraph on assets/credits
- Test: checklist vs spec acceptance

**Interfaces:**
- Consumes: running server on `:8765`
- Produces: screenshots proving acceptance criteria 1–6 from spec

- [ ] **Step 1: Play wave 1 ≥30s; confirm FPS feel OK** (no slideshow). If <30fps: disable bloom or shadows first.

- [ ] **Step 2: Capture three screenshots** (menu, street with lamps, zombie within 5m + gun in view).

- [ ] **Step 3: Verify CREDITS and gameplay** (move, shoot, damage, death restart, wave UI).

- [ ] **Step 4: Update README** with “美术资源见 `assets/CREDITS.md`”.

- [ ] **Step 5: Commit**

```bash
git add demo-cinematic-*.png README.md
git commit -m "docs: cinematic visuals acceptance screenshots"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Free glTF city/zombie/gun + CREDITS | 1 |
| Local vendor, no hotlink-only | 1–2 |
| World assembly + AABB + spawns | 3 |
| Moon + lamps + FogExp2 + exposure | 3, 6 |
| Zombie/gun readable models | 4, 5 |
| PostFX bloom + vignette | 6 |
| ≥30fps / shadow limits | 3, 6, 7 |
| Fallback textured/primitives | 3, 4, 5 |
| Gameplay unchanged | all (no waves/ammo edits) |
| Acceptance screenshots | 7 |

No TBD placeholders; filenames in Task 2 `buildingFiles` must be edited to match Task 1 downloads.
