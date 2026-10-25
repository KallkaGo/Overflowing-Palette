# 溢彩画 · ColorfulPainting

《鸣潮》溢彩画的网页复刻。

## 启动

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
```

## 构建与离线运行

```sh
npm run build
```

双击生成的 `dist/index.html` 即可离线游玩，也可通过 `npm run preview` 预览构建结果。

## 资源压缩与维护

当前离线 HTML 约 14.9 MB。字体只嵌入界面所需的 WOFF2 字符子集，关卡棋盘按每格 3 位存储。完整关卡、来源和解法保留在 `data/levels.json`；运行时读取生成的 `data/levels.js`。

以下操作需要完整本地工作副本中的 `asstesTools/` 和原始资源。新增界面文案后，确认文案文件已列入 `asstesTools/pack-game-font.py` 的 `GLYPH_SOURCES`，重新生成字体并构建：

```sh
python3 asstesTools/pack-game-font.py
npm run build
```

字体工具需要 Python 包 `fonttools[woff]`，原始字体位于 `asstesTools/assets/game/H7GBKHeavy.ttf`。修改关卡后，运行 `npm run levels` 校验原始配置与解法并生成运行时数据，再运行 `npm run build`。

普通开发与构建直接使用已生成的资源，不需要 `asstesTools/` 或 Python，也不会自动重新生成字体和关卡。

## 版权

《[鸣潮](https://mc.kurogames.com/main/)》相关内容与游戏资源的版权归[库洛游戏](https://www.kurogames.com/)所有。
