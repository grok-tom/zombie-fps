# Zombie FPS Mini-Game — Design Spec

**Date:** 2026-10-28  
**Status:** Approved  
**Delivery:** Polished browser game (Three.js)

## Goal

A short, atmospheric first-person zombie wave-survival game playable by opening a local HTML page in the browser. Session length: a few minutes of tense combat.

## Theme & Fantasy

Nighttime abandoned city block. Neon-ish cool lighting, fog, street lamps. Player holds out against escalating zombie waves.

## Core Loop

1. Click to lock pointer → start Wave 1  
2. Move with WASD, look with mouse, shoot with LMB  
3. Clear / survive wave → short break + ammo/health drops → next wave (more zombies, faster)  
4. On death → kill/wave summary → Restart  

## Controls

| Input | Action |
|-------|--------|
| Click | Pointer lock / start |
| WASD | Move |
| Mouse | Look |
| Left mouse | Fire |
| R | Reload (if ammo in reserve) |
| Esc | Release pointer (pause-ish) |

## Weapons

- **Pistol** (start): moderate damage, slow fire, limited mag  
- **SMG** (pickup): faster fire, lower damage per shot, larger mag  
- World pickups: ammo packs, medkits, SMG (once)

## Enemies

Procedural low-poly humanoid zombies: shambling walk toward player, melee damage on contact. Variants by wave: slightly faster / more HP. Red glowing eyes for readability.

## Level

Small enclosed city block (~40–60m): buildings as collision boxes, alley corridors, ground plane, fog, lamps. No multiplayer, no story cutscenes, no complex reload animations.

## HUD

Health, current ammo / reserve, wave number, kills. Crosshair center. Damage vignette on hit. Wave banner on wave start.

## Tech

- Three.js via CDN (r160+)  
- Path: `/workspace/zombie-fps/`  
- Modules under `js/`: `main.js`, `player.js`, `weapons.js`, `zombies.js`, `waves.js`, `world.js`, `ui.js`, `audio.js`  
- `index.html` entry; ES modules  
- Raycaster hitscan shooting  
- Simple AABB / capsule vs box collision  

## Out of Scope

Online multiplay, narrative, inventory UI beyond weapon swap, mobile touch, ranking servers.

## Success Criteria

- Open `index.html` (or local static server) → playable FPS wave survival  
- Visual polish: fog, lamps, muzzle flash, hit sparks, death/restart  
- Demo screenshots or short capture for handoff  
