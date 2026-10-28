# Zombie FPS Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Ship a polished browser Three.js zombie wave-survival FPS at `/workspace/zombie-fps/`.

**Architecture:** ES-module Three.js app: `world` builds the night city block; `player` handles pointer-lock movement and camera; `weapons` hitscan + muzzle FX; `zombies` AI + pools; `waves` spawns; `ui` HUD; `audio` optional WebAudio blips; `main` game loop.

**Tech Stack:** Three.js (CDN import map), vanilla ES modules, no bundler required (use `python3 -m http.server` for modules).

## Global Constraints

- Path root: `/workspace/zombie-fps/`  
- Browser only; Chinese UI strings OK for labels  
- No network multiplayer  
- Must work after `cd /workspace/zombie-fps && python3 -m http.server 8765`

## File Structure

- Create: `index.html` — shell, import map, HUD DOM  
- Create: `js/main.js` — boot, loop, state machine (menu/play/dead)  
- Create: `js/world.js` — ground, buildings, lights, fog, colliders  
- Create: `js/player.js` — camera rig, WASD, gravity optional (flat), damage  
- Create: `js/weapons.js` — pistol/SMG, raycast, muzzle flash, reloads  
- Create: `js/zombies.js` — mesh factory, chase AI, HP, contact damage  
- Create: `js/waves.js` — wave timing, spawn points, difficulty curve  
- Create: `js/ui.js` — HUD updates, banners, death screen  
- Create: `js/audio.js` — simple synthesized shot/hit/roar (optional but preferred)  
- Create: `README.md` — how to run  

---

### Task 1: Scaffold + empty scene

**Files:** Create `index.html`, `js/main.js`, `js/world.js`, `README.md`

- [ ] Create HTML with full-viewport canvas, HUD placeholders, Three.js import map  
- [ ] `world.createWorld(scene)` adds fog, hemisphere + street lamps, ground, 8–12 building boxes, returns `{ colliders }`  
- [ ] `main.js` renders at 60fps with Orbit-free PerspectiveCamera placeholder then hand off to player  
- [ ] Verify: serve and see lit night block  

### Task 2: Player movement + pointer lock

**Files:** Create `js/player.js`; modify `js/main.js`

- [ ] Pointer lock on click; yaw/pitch from mouse; WASD on XZ with collision against `colliders`  
- [ ] Eye height ~1.7; sprint optional Shift  
- [ ] Verify: walk alleys without clipping through buildings  

### Task 3: Weapons hitscan

**Files:** Create `js/weapons.js`

- [ ] Pistol defaults; ray from camera center; muzzle flash sprite/light 50ms  
- [ ] Mag + reserve; R reloads; dry-fire click  
- [ ] Expose `tryFire(dt)` / `rayHit()` for zombie damage  

### Task 4: Zombies + waves

**Files:** Create `js/zombies.js`, `js/waves.js`

- [ ] Spawn low-poly zombie (body+head+eyes emissive) at map edges  
- [ ] Seek player; contact damage with cooldown; death remove + drop chance  
- [ ] Waves: `waveN` count = 4 + N*3; speed/HP scale; intermission 4s  

### Task 5: Pickups, HUD, death/restart

**Files:** Create `js/ui.js`; wire in `main.js`

- [ ] Ammo / medkit / SMG pickups  
- [ ] HUD: HP, ammo, wave, kills; wave title flash  
- [ ] Death overlay with Restart resetting state  

### Task 6: Polish + handoff

**Files:** `js/audio.js`, tune lights/post look

- [ ] Muzzle light, hit sparks, damage red vignette, fog density tweak  
- [ ] Optional WebAudio shot/hit  
- [ ] README run steps; screenshot via headless or note for parent to capture  
