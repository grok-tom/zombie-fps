# Task 3 Report — Rebuild world assembly + lighting/fog

**Status:** DONE  
**Branch:** `feature/cinematic-visuals`  
**Commit:** `1786e39` — `feat: cinematic world assembly with glTF buildings and night lights`

## What changed

### `js/world.js`
- Signature: `createWorld(scene, assets = null)` → `{ colliders, spawnPoints, lampLights }`
- Night look: `background` / `FogExp2` `#1a2230` density `0.014`
- Lights: Hemisphere `(0x9bb4d0, 0x1a1510, 0.55)` + cool moon Directional `(0xc0d4ff, 0.85)` with `castShadow`, mapSize **1024**, tight ortho frustum
- Buildings: `placeBuilding()` clones random `assets.buildings[]` glTF, XZ-fit to footprint, feet on y=0; fallback textured/`0x6a7384` box if no assets
- Collider AABBs still from footprint list (`b.w/h/d`) — gameplay footprint unchanged
- Ground: 100×100 plane + repeating `assets/textures/asphalt.png` (async TextureLoader; flat color until load)
- Lamps: **6** warm `PointLight(0xffc070, 6, 24, decay 2)` (perf cap ≤6) + poles/heads/emissive bulbs
- Outer walls, crates, `spawnPoints`, `resolveCollision` behavior kept

### `js/main.js`
- `import { loadGameAssets }`; top-level `await loadGameAssets()` then `createWorld(scene, assets)`
- Removed duplicate `AmbientLight`
- `renderer.shadowMap.enabled = true`, `PCFSoftShadowMap`
- `toneMappingExposure = 1.15` (was 2.1)
- Lamp flicker baseline updated to ~6 ± 0.45

**Not in this task:** zombie/gun mesh swap (4–5), EffectComposer (6).

## Verification

1. Static server `python3 -m http.server 8765` — all game assets 200 (`building-*.glb`, `Textures/colormap.png`, `asphalt.png`, JS).
2. Headless Chrome screenshot (menu @ 1280×800): Kenney-style glTF buildings with windows/doors (not flat grey boxes), night fog, street lamps, HUD/overlay OK. Saved: `.superpowers/sdd/task-3-menu.png`.
3. Puppeteer boot check:
   - `window.__ZFPS.player` present after load
   - No pageerrors; no failed asset requests
   - Only console 404: `/favicon.ico` (pre-existing / unrelated)
   - WebGL “GPU stall ReadPixels” warnings from headless SwiftShader only

## Concerns / follow-ups

- Building **visual height** follows model aspect after XZ-only scale (`Math.min(sx,sz)` per brief); colliders still use original `b.h`, so collision volume can be taller/shorter than the mesh. Tasks later may want optional Y-fit or collider from `Box3` if it feels wrong in play.
- Random building pick per footprint → non-deterministic skyline each refresh (fine for demake; seed later if needed).
- Exposure `1.15` may need a tweak once Task 5–6 postfx/bloom land.
- Favicon 404 noise only; ignore or add a favicon later.

## Review fix (post Task 3 review)

**Important #1 — moon shadow ortho frustum:** After setting `moon.shadow.camera` near/far/left/right/top/bottom, call `moon.shadow.camera.updateProjectionMatrix()` so the ±40 play-area shadow volume actually applies (Three.js otherwise keeps the default ±5 ortho projection).

**Minors:** Skipped non-trivial items (building-fallback asphalt map, unlit lamp posts, skyline seeding). Ground asphalt already loads; no one-liner minor applied.

