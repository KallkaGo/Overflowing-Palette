
/* 前景文字在染色画布之外，按实际显示尺寸排版。 */
const NS = "http://www.w3.org/2000/svg";

export function createHud(config) {
  const {layout, palette, theme} = config;
  const svg = document.createElementNS(NS, "svg");
  svg.id = "game-hud";
  svg.setAttribute("aria-hidden", "true");
  svg.style.fontFamily = theme.font;
  document.body.append(svg);

  function element(tag, attributes = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    svg.append(node);
    return node;
  }
  const title = element("text", {fill: theme.titleTint});
  title.textContent = "溢彩画";
  const steps = element("text", {fill: theme.white});
  steps.textContent = "剩余步数:";
  const count = element("text");
  const note = element("text", {fill: "#a9bbba"});
  const bonus = element("text", {fill: theme.gold});
  const goal = element("text", {fill: theme.white});
  const goalLabel = document.createElementNS(NS, "tspan");
  const goalColor = document.createElementNS(NS, "tspan");
  goal.append(goalLabel, goalColor);
  const reset = element("text", {fill: theme.white, "text-anchor": "middle"});
  reset.textContent = "重置";
  const help = element("text", {fill: theme.white, "text-anchor": "middle"});
  help.textContent = "?";
  const status = element("text", {fill: theme.white, "text-anchor": "middle"});

  // 用清晰的几何图形绘制原版小圆环和成对三角标记。
  const previousRing = element("circle", {fill: "none", stroke: "#cecece", "stroke-opacity": .11});
  const nextRing = element("circle", {fill: "none", stroke: "#cecece", "stroke-opacity": .11});
  const previousArrows = element("polygon", {fill: "#94844c"});
  const previousArrow2 = element("polygon", {fill: "#94844c"});
  const nextArrows = element("polygon", {fill: "#c5c5c5", "fill-opacity": .4});
  const nextArrow2 = element("polygon", {fill: "#c5c5c5", "fill-opacity": .4});
  const dot = element("circle", {fill: theme.dotTint});
  let scale = 1, dpr = 1, headerSize = 14.4, countSize = 24.8;

  function snap(value) { return Math.round(value * dpr) / dpr; }
  function fontSize(size, minimum = 14) {
    return Math.ceil(Math.max(minimum, size * scale) * dpr) / dpr;
  }
  function place(node, x, y, size) {
    node.setAttribute("x", snap(x * scale));
    node.setAttribute("y", snap(y * scale));
    node.setAttribute("font-size", size);
  }
  function ring(node, rect, x, y) {
    node.setAttribute("cx", snap((rect.x + x * .4) * scale));
    node.setAttribute("cy", snap((rect.y + y * .4) * scale));
    node.setAttribute("r", 16 * .4 * scale);
    node.setAttribute("stroke-width", Math.max(1 / dpr, 6 * .4 * scale));
  }
  function triangle(node, rect, points) {
    node.setAttribute("points", points.map(([x, y]) =>
      snap((rect.x + x * .4) * scale) + "," + snap((rect.y + y * .4) * scale)).join(" "));
  }

  function resize(rect) {
    scale = rect.width / layout.width;
    dpr = window.devicePixelRatio || 1;
    svg.style.left = snap(rect.left) + "px";
    svg.style.top = snap(rect.top) + "px";
    svg.setAttribute("width", rect.width);
    svg.setAttribute("height", rect.height);
    // 不缩放 viewBox，也不使用 CSS 变换；文字按最终 CSS 像素尺寸排版。
    headerSize = fontSize(14.4);
    countSize = fontSize(24.8, 22);
    place(title, 96.25, 43, headerSize);
    place(steps, 68.4, 81, headerSize);
    place(count, 0, 82, countSize);
    count.setAttribute("x", snap(68.4 * scale + steps.getComputedTextLength() + 2 * scale));
    place(note, 68, 214, fontSize(14));
    place(bonus, 68, 239, fontSize(13, 12));
    place(goal, 350, 544, fontSize(14.4));
    place(reset, 942, 544, fontSize(14.4));
    place(help, 1116, 40.5, fontSize(15, 12));
    place(status, layout.board.x + layout.board.width / 2,
      layout.board.y + layout.board.height / 2 + 8, fontSize(24, 20));
    const {previous, next} = layout.paletteCues;
    ring(previousRing, previous, 31.5, 22.5);
    ring(nextRing, next, 21.5, 91.5);
    triangle(previousArrows, previous, [[0, 61], [32, 61], [16, 88]]);
    triangle(previousArrow2, previous, [[31, 61], [63, 61], [47, 88]]);
    triangle(nextArrows, next, [[6, 29], [38, 29], [22, 3]]);
    triangle(nextArrow2, next, [[6, 55], [38, 55], [22, 29]]);
    dot.setAttribute("cx", snap((layout.footer.dot.x + 10) * scale));
    dot.setAttribute("cy", snap((layout.footer.dot.y + 10) * scale));
    dot.setAttribute("r", 8 * scale);
  }

  function text(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }
  function draw(session, ui) {
    text(count, String(session.movesLeft));
    count.setAttribute("fill", session.movesLeft === 1 ? theme.dangerStepColor : theme.stepColor);
    count.setAttribute("font-size", countSize * (1 + ui.movePulse * .07));
    text(note, session.level.note);
    const bonusText = session.earnedBonus > session.stepBonus ? "已解锁奖励步数 · 重置时可选"
      : session.stepBonus > 0 ? "基础" + session.level.moves + "步 + 原版奖励" + session.stepBonus + "步" : "";
    text(bonus, bonusText);
    bonus.setAttribute("y", snap((session.level.note ? 239 : 214) * scale));
    const tip = ui.tipFlash && ui.sceneTime < ui.tipFlash.until;
    text(goalLabel, tip ? ui.tipFlash.text : "将色块全部染成");
    text(goalColor, tip ? "" : "【" + palette[session.target].name + "色】");
    goalColor.setAttribute("fill", palette[session.target].hex);
    text(status, session.finished ? session.phase === "won" ? "绘制完成" : "步数用尽 · 按 R 重新绘制" : "");
    if (session.finished) status.setAttribute("font-size", fontSize(24, 20) * ui.statusScale);
  }

  return {resize, draw};
}
