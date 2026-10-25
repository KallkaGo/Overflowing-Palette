/* 纯棋盘规则，由浏览器会话和关卡维护工具共用。 */
export const BLOCKED = -1;

function neighbors(index, cols, rows) {
  const row = Math.floor(index / cols), col = index % cols;
  const result = [];
  // 保留原版的遍历顺序：上、左、下、右。
  if (row > 0) result.push([index - cols, .25]);
  if (col > 0) result.push([index - 1, .5]);
  if (row < rows - 1) result.push([index + cols, .75]);
  if (col < cols - 1) result.push([index + 1, 0]);
  return result;
}

function blendDirection(a, b) {
  const difference = Math.abs(a - b);
  if (difference === .5) return a;
  const result = difference > .5 ? (a + b - 1) / 2 : (a + b) / 2;
  return result < 0 ? result + 1 : result;
}

/** 返回点击位置的同色连通区域，以及动画传播层数和方向。 */
export function spread(board, index, cols, rows) {
  const color = board[index];
  if (color === BLOCKED) return new Map();
  const result = new Map([[index, {depth: 0, direction: -1}]]);
  const queue = [index];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], depth = result.get(current).depth + 1;
    for (const [next, direction] of neighbors(current, cols, rows)) {
      if (board[next] !== color) continue;
      const queued = result.get(next);
      if (queued) {
        if (queued.depth === depth) {
          queued.direction = blendDirection(queued.direction, direction);
        }
      } else {
        result.set(next, {depth, direction});
        queue.push(next);
      }
    }
  }
  return result;
}

/** 对一维棋盘应用一步染色，不修改输入数组；坐标从 0 开始。 */
export function paint(board, {row, col, color}, cols, rows) {
  const next = board.slice(), index = row * cols + col;
  if (next[index] === BLOCKED || next[index] === color) return next;
  for (const cell of spread(board, index, cols, rows).keys()) next[cell] = color;
  return next;
}

export function isComplete(board, target) {
  return board.every(color => color === BLOCKED || color === target);
}

