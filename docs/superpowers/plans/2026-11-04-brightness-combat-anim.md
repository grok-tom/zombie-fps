# Brightness + Combat Feedback Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the night scene clearly brighter for enemy readability, and add procedural player gun recoil + hurt camera/viewmodel shake plus stronger zombie claw pose and hit stagger.

**Architecture:** Tune lighting/fog/exposure/vignette constants in place. Extend existing viewmodel pose helpers in `weapons.js` with a recoil envelope and optional hurt offset. Add `hurtShake` on `Player` applied in `syncCamera`. Extend zombie state with `stagger` knockback and lengthen `ATTACK_POSE_TIME`.

**Tech Stack:** Three.js r160 ES modules, GitHub Pages from `master`.

## Global Constraints

- Route A only: procedural poses, no new glTF animation clips.
- Keep ≤6 street point lights; bloom kill-switch `__ZFPS_FX.bloom` unchanged.
- Do not change reload dip/roll behavior except mutual exclusion with recoil (reload wins).
- Work on branch `feature/brightness-combat-anim`; do not merge to master unless the user asks.
- Spec: `docs/superpowers/specs/2026-11-04-brightness-combat-anim-design.md`.

## File map

| File | Responsibility |
|------|----------------|
| `js/main.js` | exposure `2.15`; lamp flicker base `14 ± 0.8` |
| `js/world.js` | fog `0.0045`, hemi `1.35`, moon `1.7`, lamps `14/38`, bulb emissive `4.0` |
| `js/postfx.js` | soften vignette darkness (e.g. `0.95` → `0.72`) |
| `js/player.js` | `hurtShake` impulse + decay; apply roll/pitch in `syncCamera` |
| `js/weapons.js` | fire recoil envelope; side-flinch from `player.hurtShake` |
| `js/zombies.js` | longer attack pose; stagger knockback on damage |

No new files.

---

### Task 1: Brightness pass

**Files:**
- Modify: `js/main.js` (exposure, flicker)
- Modify: `js/world.js` (fog, hemi, moon, lamps)
- Modify: `js/postfx.js` (vignette darkness)

**Interfaces:**
- Consumes: none
- Produces: brighter night defaults matching the spec table

- [ ] **Step 1: Patch lighting constants**

In `js/main.js`:
- `renderer.toneMappingExposure = 2.15;`
- Flicker: `L.intensity = 14 + Math.sin(now * 0.004 + L.position.x) * 0.8;`

In `js/world.js`:
- `scene.fog = new THREE.FogExp2(0x2a3548, 0.0045);`
- HemisphereLight intensity `1.35`
- DirectionalLight (moon) intensity `1.7`
- bulb `emissiveIntensity: 4.0`
- `new THREE.PointLight(0xffc070, 14, 38, 2)`

In `js/postfx.js`:
- VignetteShader `darkness: { value: 0.72 }` (was 0.95)

- [ ] **Step 2: Verify by grep**

Run:
```bash
rg -n "toneMappingExposure|FogExp2|HemisphereLight|DirectionalLight|PointLight\(0xffc070|emissiveIntensity: 4|darkness:|intensity = 14" js/main.js js/world.js js/postfx.js
```
Expected: values match Step 1 (exposure 2.15, fog 0.0045, hemi 1.35, moon 1.7, light 14/38, bulb 4.0, darkness 0.72, flicker 14).

- [ ] **Step 3: Commit**

```bash
git add js/main.js js/world.js js/postfx.js
git commit -m "feat: clearer night brightness for combat readability"
```

---

### Task 2: Player recoil + hurt shake

**Files:**
- Modify: `js/player.js`
- Modify: `js/weapons.js`
- Modify: `js/main.js` (wire `weapons.hurtSource = player` or pass hurt strength each frame — prefer `weapons.setHurtShake(() => player.hurtShake)`)

**Interfaces:**
- Consumes: existing `takeDamage`, viewmodel pose helpers
- Produces:
  - `player.hurtShake` number in `[0,1+]`, set to `1` on damage, decays in `update`
  - `Weapons` recoil: `this.recoil = 0`..`1`, set on successful fire
  - Reload pose still overrides recoil while `reloading`

- [ ] **Step 1: Add hurtShake on Player**

In `js/player.js` constructor add `this.hurtShake = 0;`.

In `takeDamage`:
```js
this.damageFlash = 1;
this.hurtShake = 1;
```

In `reset`: `this.hurtShake = 0;`

In `syncCamera`, after setting yaw/pitch base rotations, apply shake:
```js
const hs = Math.min(1, this.hurtShake);
this.camera.rotation.z = Math.sin(performance.now() * 0.045) * 0.045 * hs;
this.camera.rotation.x = this.pitch + Math.sin(performance.now() * 0.06) * 0.025 * hs;
```
(Keep `rotation.y = this.yaw` unchanged.)

In `update` (alive and dead branches), decay:
```js
this.hurtShake = Math.max(0, this.hurtShake - dt * 3.2);
```

- [ ] **Step 2: Add recoil + hurt flinch on Weapons**

In constructor: `this.recoil = 0; this._hurtShakeFn = null;`

Add:
```js
setHurtShake(fn) { this._hurtShakeFn = fn; }

_kickRecoil() {
  const auto = this.def.auto;
  this.recoil = Math.min(1, this.recoil + (auto ? 0.55 : 1));
}
```

On successful fire (where muzzle flash is triggered), call `this._kickRecoil()`.

In the viewmodel update section (where reload/bob is applied), after computing reload vs bob:

Priority: if reloading → `_applyReloadGunPose`; else apply rest + recoil + hurt:

```js
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
```

Each frame when not reloading:
```js
const hurt = this._hurtShakeFn ? this._hurtShakeFn() : 0;
this._applyCombatGunPose(bobY, this.recoil, hurt);
this.recoil = Math.max(0, this.recoil - dt * (this.def.auto ? 10 : 7));
```

In `reset`, clear `this.recoil = 0` and rest pose.

In `js/main.js` after constructing weapons:
```js
weapons.setHurtShake(() => player.hurtShake);
```

- [ ] **Step 3: Verify by grep / node parse**

```bash
rg -n "hurtShake|setHurtShake|_kickRecoil|_applyCombatGunPose|this\.recoil" js/player.js js/weapons.js js/main.js
node --check js/player.js && node --check js/weapons.js && node --check js/main.js
```
Expected: symbols present; node --check exit 0.

- [ ] **Step 4: Commit**

```bash
git add js/player.js js/weapons.js js/main.js
git commit -m "feat: gun recoil and player hurt camera/viewmodel shake"
```

---

### Task 3: Zombie claw + hit stagger

**Files:**
- Modify: `js/zombies.js`

**Interfaces:**
- Consumes: existing `attackPose`, `applyAttackPose`, `resolveCollision`, `damageZombie`
- Produces: `ATTACK_POSE_TIME = 0.55`; `stagger` timer + knockback on non-lethal hit

- [ ] **Step 1: Lengthen attack pose and amplify applyAttackPose**

Set `const ATTACK_POSE_TIME = 0.55;`

In `applyAttackPose`, increase arm raise and glTF lean multipliers by ~30–40% vs current (e.g. arm strength factors `1.15/1.25` → `1.5/1.65`, lean stronger). Read current function and scale numbers; do not remove claw VFX.

- [ ] **Step 2: Add stagger on damage**

Constants:
```js
const STAGGER_TIME = 0.28;
const STAGGER_SPEED = 4.5; // m/s away from player while staggering
```

On spawn zombie object add `stagger: 0` and `staggerDirX: 0`, `staggerDirZ: 0`.

In `damageZombie`, before death check, if still alive after hp subtract (or always set then clear on death):
```js
zombie.stagger = STAGGER_TIME;
// direction filled in update using last known player vector — OR compute in damageZombie if we pass playerPos
```

Cleaner: change `damageZombie(zombie, amount, fromPos)` optional third arg:

```js
damageZombie(zombie, amount, fromPos = null) {
  ...
  if (zombie.hp > 0 && fromPos) {
    const dx = zombie.mesh.position.x - fromPos.x;
    const dz = zombie.mesh.position.z - fromPos.z;
    const len = Math.hypot(dx, dz) || 1;
    zombie.staggerDirX = dx / len;
    zombie.staggerDirZ = dz / len;
    zombie.stagger = STAGGER_TIME;
  } else if (zombie.hp > 0) {
    zombie.stagger = STAGGER_TIME;
  }
  ...
}
```

Update call site in `js/main.js`:
```js
const died = zombies.damageZombie(z, hit.damage, player.position);
```

In `update`, after computing `nx,nz` toward player, if `z.stagger > 0`:
```js
z.stagger -= dt;
const sx = z.staggerDirX || -nx;
const sz = z.staggerDirZ || -nz;
z.mesh.position.x += sx * STAGGER_SPEED * dt;
z.mesh.position.z += sz * STAGGER_SPEED * dt;
resolveCollision(...);
// skip forward chase movement this frame while staggering
```
Else keep existing chase movement.

While staggering, apply slight lean back via `applyAttackPose(z, -0.35 * (z.stagger / STAGGER_TIME))` only if that function accepts negative strength — if not, add `applyStaggerPose(z, t)` that leans back for box arms / glTF pitch.

Simplest: if `stagger > 0`, set visual lean back in the same branch as attack pose with strength `z.stagger / STAGGER_TIME` using a small new helper `applyStaggerPose(z, strength)` (arms down/back for box; glTF rotation.x positive lean back).

- [ ] **Step 3: Verify**

```bash
rg -n "ATTACK_POSE_TIME|STAGGER_|stagger|applyStaggerPose|damageZombie\(" js/zombies.js js/main.js
node --check js/zombies.js && node --check js/main.js
```
Expected: `ATTACK_POSE_TIME` is 0.55; stagger symbols present; parse OK.

- [ ] **Step 4: Commit**

```bash
git add js/zombies.js js/main.js
git commit -m "feat: stronger zombie claw pose and hit stagger"
```

---

### Task 4: Smoke-check + push PR (no merge)

**Files:** none new

- [ ] **Step 1: Syntax check all touched modules**

```bash
node --check js/main.js && node --check js/world.js && node --check js/postfx.js && node --check js/player.js && node --check js/weapons.js && node --check js/zombies.js
```
Expected: all exit 0.

- [ ] **Step 2: Push branch and open PR**

```bash
git push -u origin feature/brightness-combat-anim
gh pr create --base master --head feature/brightness-combat-anim --title "提亮可读性 + 战斗反馈动画" --body "$(cat <<'BODY'
## 摘要
明显提亮夜景（可读优先），并补玩家开枪后坐 / 挨打晃动、僵尸挥爪加长、中弹踉跄。

规格：`docs/superpowers/specs/2026-11-04-brightness-combat-anim-design.md`

## 验收
1. 更亮、敌人更清楚，仍非白昼
2. 开枪有后坐；换弹仍正常
3. 挨打：红边 + 镜头晃 + 枪口侧闪
4. 僵尸挥爪更明显；中弹短暂后退

未合并，确认后再合并更新 Pages。
BODY
)"
```

- [ ] **Step 3: Report PR URL to parent; do not merge**

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Brightness table + softer vignette | Task 1 |
| Player fire recoil | Task 2 |
| Player hurt camera + gun flinch + keep vignette | Task 2 |
| Longer zombie claw pose | Task 3 |
| Hit stagger knockback + collision clamp | Task 3 |
| PR, no auto-merge | Task 4 |
