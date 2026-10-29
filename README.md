# 夜巷求生 · Zombie FPS

浏览器端 Three.js 第一人称丧尸波次生存小游戏。

## 运行

必须用本地静态服务器（ES modules 无法直接用 `file://`）：

```bash
cd /workspace/zombie-fps
python3 -m http.server 8765
```

浏览器打开：http://localhost:8765/

## 操作

| 按键 | 作用 |
|------|------|
| 点击画面 | 锁定鼠标 / 开始 / 复活重开 |
| WASD | 移动 |
| 鼠标 | 视角 |
| 左键 | 射击 |
| R | 换弹 |
| Shift | 冲刺 |
| 1 / 2 | 手枪 / 冲锋枪（获得后） |
| Esc | 释放鼠标 |

## 玩法

- 夜晚废弃街区，守住波次
- 开局手枪；第 2 波附近会出现冲锋枪拾取
- 击杀有几率掉弹药 / 医疗包
- 波次间短暂休整，难度随波次提升

## 目录

```
index.html
js/main.js      # 启动与主循环
js/world.js     # 地图、灯光、碰撞
js/player.js    # 移动与受伤
js/weapons.js   # 射击与枪械
js/zombies.js   # 丧尸 AI
js/waves.js     # 波次导演
js/ui.js        # HUD / 结算
js/audio.js     # WebAudio 音效
```

## 技术

Three.js r160（CDN import map），原生 ES modules，无需打包。
