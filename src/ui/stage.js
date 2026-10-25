/* 画布铺满窗口，固定宽高比的游戏布局在画布内居中缩放。 */
export function stageRect(canvas, layout) {
  const view = canvas.getBoundingClientRect();
  const scale = Math.min(view.width / layout.width, view.height / layout.height);
  const width = layout.width * scale, height = layout.height * scale;
  return {left: view.left + (view.width - width) / 2, top: view.top + (view.height - height) / 2, width, height, scale};
}
