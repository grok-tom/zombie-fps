# Task 2 Report: Asset loader module

## Status
DONE

## Summary
Implemented `js/assets.js` with `loadGameAssets`, `cloneZombie`, and `clonePistol`. Loader uses Three.js r160 `GLTFLoader`, enables cast/receive shadows on meshes, and sets `SRGBColorSpace` on material maps. Building list matches Task 1 vendored files (a–c required paths plus optional d/e/skyscraper). Zombie/pistol/smg load with try/catch fallbacks (null prototypes on failure). Did not touch world/zombies/weapons (Tasks 3–5). Did not modify `index.html`.

## Files
- Created: `js/assets.js` (92 lines)
- Smoke helper used then deleted: `smoke-assets.html` (not committed)

## Building paths used
```
assets/city/building-a.glb
assets/city/building-b.glb
assets/city/building-c.glb
assets/city/building-d.glb          # optional extra
assets/city/building-e.glb          # optional extra
assets/city/building-skyscraper-a.glb  # optional extra
```

Kenney sibling texture folders left in place (GLBs not moved):
- `assets/city/Textures/colormap.png`
- `assets/weapons/Textures/colormap.png`

## Tests
1. Syntax: stripped import/export parse via Node `new Function` — OK
2. Static server (`python3 -m http.server 8765` in worktree):
   - `curl -I` 200 for `js/assets.js`, all 6 city GLBs, zombie/pistol/smg GLBs, both `Textures/colormap.png`
3. Headless Chrome + CDP load of temporary `smoke-assets.html`:
   ```
   OK {"ready":true,"buildings":6,"zombie":true,"zombieClips":32,"pistol":true,"smg":true,"cloneZombie":true,"clonePistol":true}
   ```
   No uncaught exception; clones return objects.

## Commit
- `6aeb0b6` feat: GLTF asset loader for city, zombie, weapons
  - Author override: `游戏开发 <bot@local>`

## Concerns
None blocking. Note: game `index.html` / other `js/*` remain untracked on `master` and are absent from this worktree checkout (only docs + assets were committed before Task 2). Task 2 only adds the loader module as specified; later tasks that wire `main.js` will need those sources present in the worktree (copy/commit from main tree) before integration.

## Out of scope (not started)
- Task 3 world/lights
- Task 4 zombies
- Task 5 weapons
- Task 6 postfx / index loading UI


## Review fix (Important #1 + easy Minor)

**Date:** 2026-10-29 Asia/Shanghai

### Fixed
1. **Important:** `cloneZombie` now uses `SkeletonUtils.clone` from `three/addons/utils/SkeletonUtils.js` instead of `Object3D.clone(true)`, because `zombie.glb` is skinned (2 skins). `clonePistol` still uses normal `.clone(true)`.
2. **Minor (easy):** building GLBs load via `Promise.allSettled` in parallel (same skip-on-fail semantics).

### Skipped Minors
- `prepare` only sets `map.colorSpace` — fine for current Kenney/character assets (future-only).
- No committed smoke harness — still temporary, deleted after verify.
- Worktree game sources — out of Task 2 scope.

### Re-test (headless Chrome + CDP)
```
OK {"ready":true,"buildings":6,"zombie":true,"zombieClips":32,"pistol":true,"smg":true,"cloneZombie":true,"clonePistol":true,"usesSkeletonUtils":true,"skeletonUtilsExport":true,"cloneSkins":2,"cloneBonesOk":true}
```
Confirmed source imports `SkeletonUtils` and calls `SkeletonUtils.clone`; clone has 2 skinned meshes with non-null bones.

### Commit
- (see git log) `fix: clone skinned zombies via SkeletonUtils`
