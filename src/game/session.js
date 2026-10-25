/* 管理游戏状态与染色调度，不依赖 DOM、画布、音频或资源加载。 */
import {BLOCKED, spread, isComplete} from "./board.js";
const paintDelay = depth => (1100 * (1 - Math.exp(-depth * .36)) + 90 * depth) / 1000;

export class Session {
  constructor(catalog, animation) {
    this.catalog = catalog;
    this.animation = animation;
    this.cols = catalog.cols;
    this.rows = catalog.rows;
    // 原版世界实体在重置棋盘后仍保留有效染色次数。
    this.paintCounts = new Map();
    this.loadLevel(0);
  }

  get level() { return this.catalog.levels[this.levelIndex]; }
  get locked() { return this.phase === "painting"; }
  get finished() { return this.phase === "won" || this.phase === "lost"; }
  get paintCount() { return this.paintCounts.get(this.level.id) ?? 0; }
  get earnedBonus() {
    if (!this.level.retryBonusEnabled) return 0;
    return this.level.bonusRules.reduce((bonus, rule) =>
      this.paintCount >= rule.paintCount ? Math.max(bonus, rule.addStep) : bonus, 0);
  }

  loadLevel(index) {
    const count = this.catalog.levels.length;
    this.levelIndex = (index % count + count) % count;
    this.startBoard(this.earnedBonus);
  }

  reset(claimBonus) {
    this.startBoard(claimBonus ? this.earnedBonus : this.stepBonus);
  }

  startBoard(bonus) {
    this.availableColors = this.level.availableColors;
    this.selected = this.availableColors[0];
    this.target = this.level.targetColor;
    this.stepBonus = bonus;
    this.moveBudget = this.level.moves + bonus;
    this.movesLeft = this.moveBudget;
    this.phase = "playing";
    this.cells = this.level.board.flatMap((row, r) => row.map((color, c) => ({
      r, c, color, from: color, animation: null
    })));
  }

  selectColor(index) {
    if (!this.availableColors.includes(index) || index === this.selected) return false;
    this.selected = index;
    return true;
  }

  selectRelative(delta) {
    const current = this.availableColors.indexOf(this.selected), count = this.availableColors.length;
    return this.selectColor(this.availableColors[(current + delta % count + count) % count]);
  }

  paint(index) {
    if (this.phase !== "playing") return "blocked";
    if (this.cells[index].color === BLOCKED) return "blocked";
    if (this.cells[index].color === this.selected) return "same-color";
    const board = this.cells.map(cell => cell.color);
    const targets = spread(board, index, this.cols, this.rows);
    this.phase = "painting";
    this.movesLeft--;
    if (this.level.retryBonusEnabled) this.paintCounts.set(this.level.id, this.paintCount + 1);
    for (const [cellIndex, {depth, direction}] of targets) {
      const cell = this.cells[cellIndex], delay = paintDelay(depth);
      cell.from = cell.color;
      cell.color = this.selected;
      cell.animation = {
        elapsed: -delay, direction, root: depth === 0, order: depth,
        started: false, baseReady: false,
        rate: depth === 0 ? 1 : Math.max(.5, Math.min(1.2, (.5 + .7 * delay * 1000) / 30))
      };
    }
    return "painted";
  }

  /** 推进有效游戏时间，只返回本帧产生的事件。 */
  update(dt) {
    const waves = new Set();
    const {ticksPerSecond, changeEnd, pointStart, pointEnd} = this.animation;
    for (const cell of this.cells) {
      const animation = cell.animation;
      if (!animation) continue;
      animation.elapsed += dt;
      if (animation.elapsed >= 0) {
        if (!animation.started) {
          animation.started = true;
          waves.add(animation.order);
        } else animation.baseReady = true;
      }
      const duration = (animation.root ? pointEnd - pointStart : changeEnd) / ticksPerSecond;
      if (animation.elapsed * animation.rate >= duration) cell.animation = null;
    }
    let outcome = null;
    if (this.locked && this.cells.every(cell => !cell.animation)) {
      if (isComplete(this.cells.map(cell => cell.color), this.target)) this.phase = "won";
      else this.phase = this.movesLeft === 0 ? "lost" : "playing";
      if (this.finished) outcome = this.phase;
    }
    return {waves: [...waves], outcome};
  }
}

