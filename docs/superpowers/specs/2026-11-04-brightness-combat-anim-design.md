# 提亮 + 战斗反馈动画设计

日期：2026-11-04  
仓库：`zombie-fps`（夜巷求生）  
路线：**A — 参数提亮 + 程序化反馈动画**（不换 glTF 骨骼片）

## 目标

1. **明显提亮**：优先看清敌人；夜景氛围可弱一些，但仍不像白昼。
2. **玩家攻击 / 受击可读**：开枪有后坐；挨打有镜头晃 + 枪口侧闪（保留红边）。
3. **僵尸挥爪 / 中弹可读**：挥爪姿势更长更明显；中弹短暂踉跄后退（保留闪光与爪痕/血粒子）。

## 非目标

- 不接入新的 glTF 骨骼动画片段。
- 不做复杂死亡演出；击杀仍用现有倒地/移除逻辑。
- 不重做换弹动画（保持现有 dip/roll）。
- 不关闭 bloom / 暗角（暗角可略减弱）。

## 1. 亮度

相对当前 master（combat-feel-polish 后）：

| 参数 | 当前 | 目标 |
|------|------|------|
| `toneMappingExposure` | 1.75 | **2.15** |
| `FogExp2` density | 0.0072 | **0.0045** |
| HemisphereLight intensity | 1.05 | **1.35** |
| Moon DirectionalLight | 1.35 | **1.7** |
| Street PointLight | 11.5 / dist 32 | **14 / dist 38** |
| Lamp bulb emissiveIntensity | ~3.2 | **~4.0** |
| Flicker base | ~11.5 | 跟路灯峰值同步（约 **14 ± 0.8**） |

后处理：保留 bloom；暗角强度略降（可读优先）。`__ZFPS_FX.bloom` kill-switch 行为不变。

涉及文件：`js/main.js`、`js/world.js`；若暗角在 `js/postfx.js` 则一并调。

## 2. 玩家攻击（开枪后坐）

在 `js/weapons.js` 的 viewmodel 更新里，开火瞬间叠加短促 recoil envelope（与 reload pose 互斥：换弹中不叠 recoil，或 recoil 被 reload 覆盖）。

- 位移：枪模略后移 + 上抬（+ 极小横移可选）。
- 旋转：轻微 pitch up。
- 时长：手枪约 **0.12–0.16s**，冲锋枪约 **0.06–0.09s**（自动火时每发刷新 envelope，幅度略小于手枪）。
- 与现有 muzzle flash / sparks 并存；idle bob 在 recoil 归零后恢复。

## 3. 玩家受击

在 `js/player.js`（及主循环接线）增加短时 hurt impulse：

- **镜头**：相机本地小幅 roll/pitch 晃动，衰减约 **0.25–0.4s**。
- **枪口**：viewmodel 侧闪一下（由 weapons 读 player 的 hurt 强度，或 player 暴露 `hurtShake`）。
- **UI**：保留现有 `damageFlash` 红边 vignette，不替代镜头晃。

触发点：现有僵尸接触伤害回调处（`main.js` 里 `audio.hurt()` / `player.takeDamage` 同路径）。

## 4. 僵尸挥爪

在 `js/zombies.js` 加强现有 `attackPose`：

- 姿态时间加长（例如峰值保持更久，总时长约 **0.45–0.6s**）。
- 盒模：手臂抬起角度更大；glTF：整体前倾幅度更大。
- 保留 `spawnClawBurst` 爪痕 + 血粒子；不强制改粒子数量，除非挥爪可读性仍不足。

## 5. 僵尸中弹踉跄

`damageZombie` 时：

- 设置短时 `stagger`（约 **0.2–0.35s**）。
- 沿「僵尸 → 玩家」反方向水平后退一小段（有上限，避免穿墙过多；可用现有碰撞/边界简单夹紧）。
- 盒模可略后仰手臂/躯干；glTF 整体后仰。
- 保留现有 hit emissive flash；死亡路径不另做 stagger 片。

## 文件与分支

预计改动：`js/main.js`、`js/world.js`、`js/postfx.js`（若有暗角常量）、`js/weapons.js`、`js/player.js`、`js/zombies.js`。

实现在新分支（如 `feature/brightness-combat-anim`），完成后开 PR，**不默认合并**；用户确认后再合 master 并更新 Pages。

## 验收

1. 夜景明显更亮，敌人轮廓易辨，仍非白昼。
2. 开枪：枪模可见后坐；换弹动画仍正常。
3. 挨打：红边 + 镜头晃 + 枪口侧闪，短时结束。
4. 僵尸接触攻击：挥爪更明显 + 爪痕/血。
5. 僵尸中弹：闪光 + 短暂后退踉跄；击杀行为与现网一致。

## 风险

- 软件渲染 / 无 GPU 预览仍可能比本机 Chrome 暗。
- 路灯距离加大可能略增 fill；保持 ≤6 盏点光上限。
- 踉跄后退若无墙体夹紧可能出界——实现时对水平位移做简单边界限制。
