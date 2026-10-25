# 溢彩画 · ColorfulPainting

《鸣潮》溢彩画的网页复刻。

[在线体验](https://overflowing-palette.vercel.app/)

## 实现流程

核心是四邻域洪水填充（Flood Fill），使用广度优先搜索（BFS）确定本次染色的连通区域。

```mermaid
flowchart TD
    selectCell["选择颜料并点击色块"] --> invalid{"灰格或与颜料同色？"}
    invalid -->|"是"| ignored(["忽略操作，不扣步"])
    invalid -->|"否"| enqueue["起点入队并标记已访问"]
    enqueue --> pending{"还有待处理格？"}
    pending -->|"是"| expand["处理队首格：将同原色、未访问的四邻格标记并入队"]
    expand --> pending
    pending -->|"否"| recolor["连通区域统一染色，步数减一"]
    recolor --> animation["等待染色动画结束"]
    animation --> complete{"所有非灰格均为目标色？"}
    complete -->|"是"| won(["通关"])
    complete -->|"否"| exhausted{"剩余步数为零？"}
    exhausted -->|"是"| lost(["失败"])
    exhausted -->|"否"| nextClick(["等待下一次点击"])
```

设棋盘共有 N 个格子，单次染色计算的最坏时间和额外空间复杂度均为 O(N)。

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

## 版权

《[鸣潮](https://mc.kurogames.com/main/)》相关内容与游戏资源的版权归[库洛游戏](https://www.kurogames.com/)所有。
