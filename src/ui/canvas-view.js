import {loadAssets} from "./assets.js";
import {createHud} from "./hud.js";
import {stageRect} from "./stage.js";
import {PaintRenderer} from "../../render/paint-renderer.js";

/* 只负责画布呈现，玩法规则和输入由独立模块处理。 */

export async function createCanvasView(canvas, config) {
  const {palette, layout, theme} = config;
  const {width: DW, height: DH, board, orbs} = layout;
  const {x: BX, y: BY, width: GRID_W, height: GRID_H} = board;
  const {gold: GOLD, white: WHITE} = theme;
  const ctx = canvas.getContext("2d");
  const [assets, paintRenderer] = await Promise.all([
    loadAssets(palette),
    PaintRenderer.create({width: DW, height: DH, geometry: {
      x: BX, y: BY, cw: board.cellWidth, ch: board.cellHeight,
      pitchX: board.pitchX, pitchY: board.pitchY
    }})
  ]);
  const hud = createHud(config);
  const BACKDROP = "#111b1d";
  const FX = 289, FY = 39, FW = 600, FH = 520; // 棋盘外框矩形
  let renderScale = 1, offsetX = 0, offsetY = 0, background, pigments;

  function surface(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * renderScale);
    canvas.height = Math.ceil(height * renderScale);
    const g = canvas.getContext("2d");
    g.scale(canvas.width / width, canvas.height / height);
    return {canvas, g};
  }

  function makeBackdrop() {
    const output = surface(DW, DH), art = surface(DW, DH);
    output.g.fillStyle = BACKDROP;
    output.g.fillRect(0, 0, DW, DH);
    // 世界背景已按要求移除，保留原版 UI 饰纹。
    art.g.drawImage(assets.ornaments[0], 1053.2, -155.59936, 419.2, 510.4);
    art.g.drawImage(assets.ornaments[1], -204, 345.19984, 475.2, 390.4);
    art.g.globalCompositeOperation = "destination-out";
    for (const mask of assets.masks) art.g.drawImage(mask, 0, 0, DW, DH);
    output.g.drawImage(art.canvas, 0, 0, DW, DH);
    return output.canvas;
  }

  function makePigment(color) {
    const output = surface(64, 64), g = output.g, image = assets.normal[color];
    const y = orbs.y + color * orbs.step;
    g.fillStyle = palette[color].pigment;
    g.fillRect(0, 0, 64, 64);
    g.globalAlpha = theme.pigmentTextureWeight;
    g.drawImage(image, (orbs.x - 32) / DW * image.width, (y - 32) / DH * image.height,
      64 / DW * image.width, 64 / DH * image.height, 0, 0, 64, 64);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "destination-in";
    g.drawImage(assets.circle, 0, 0, 64, 64);
    return output.canvas;
  }

  function resize() {
    const view = canvas.getBoundingClientRect(), stage = stageRect(canvas, layout), ratio = window.devicePixelRatio || 1;
    hud.resize(stage);
    const width = Math.round(view.width * ratio), height = Math.round(view.height * ratio);
    const scale = stage.scale * ratio, x = Math.round((stage.left - view.left) * ratio), y = Math.round((stage.top - view.top) * ratio);
    if (width === canvas.width && height === canvas.height && scale === renderScale && background) return;
    canvas.width = width;
    canvas.height = height;
    renderScale = scale;
    offsetX = x;
    offsetY = y;
    ctx.setTransform(scale, 0, 0, scale, x, y);
    paintRenderer.resize(Math.round(DW * scale), Math.round(DH * scale));
    background = makeBackdrop();
    pigments = palette.map((_, index) => makePigment(index));
  }

  function triangle(x, y, size, up, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y + (up ? size / 2 : -size / 2));
    ctx.lineTo(x + size / 2, y + (up ? size / 2 : -size / 2));
    ctx.lineTo(x, y + (up ? -size / 2 : size / 2));
    ctx.closePath();
    ctx.fill();
  }

  function drawBackground(target) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.drawImage(background, 0, 0, DW, DH);
    ctx.drawImage(assets.boardBackground, 307.4, 51, 584, 480);
    ctx.drawImage(assets.frames[target], FX, FY, FW, FH);
  }

  function drawOrb(index, selected) {
    const y = orbs.y + index * orbs.step;
    ctx.drawImage(pigments[index], orbs.x - 32, y - 32, 64, 64);
    if (index !== selected) return;
    ctx.beginPath();
    ctx.arc(orbs.x, y, 32, 0, Math.PI * 2);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(992.243, y);
    ctx.scale(-1, 1);
    ctx.drawImage(assets.arrow, -10.4, -12.8, 20.8, 25.6);
    ctx.restore();
  }

  function drawReset() {
    ctx.save();
    ctx.translate(942, 500);
    ctx.strokeStyle = WHITE;
    ctx.fillStyle = WHITE;
    ctx.lineWidth = 4.3;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.7;
    for (const rotation of [0, Math.PI]) {
      ctx.save();
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.arc(0, 0, 10, -2.8, -.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(11, -6);
      ctx.lineTo(11, 1);
      ctx.lineTo(5, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTopControls() {
    ctx.strokeStyle = WHITE;
    ctx.fillStyle = WHITE;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(1116, 35, 10.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1116, 35, 7.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(1186, 35);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.lineTo(12, 12);
      ctx.lineTo(9, 3);
      ctx.lineTo(3, 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGoal() {
    triangle(324, 538, 14, false, "#c9cbb8");
    triangle(338, 538, 14, false, GOLD);
    // 这些是原版固定饰纹，不表示关卡进度。
    const rect = layout.footer.trim;
    ctx.drawImage(assets.footerTrim, rect.x, rect.y, rect.width, rect.height);
  }

  // 切换关卡时，旧外框与色块逐渐溶解，显露新棋盘；效果仅作用于外框矩形内。
  const MASK_W = Math.round(FW / 4), MASK_H = Math.round(FH / 4), EDGE = .3;
  function makeTransitionNoise() {
    const grid = (cols, rows) => Array.from({length: cols * rows}, Math.random);
    const layers = [[7, 6, .5], [16, 13, .3], [34, 27, .15]].map(([c, r, w]) => ({c, r, w, v: grid(c + 1, r + 1)}));
    const out = new Float32Array(MASK_W * MASK_H);
    for (let y = 0; y < MASK_H; y++) for (let x = 0; x < MASK_W; x++) {
      let n = Math.random() * .05;
      for (const {c, r, w, v} of layers) {
        const fx = x / MASK_W * c, fy = y / MASK_H * r, ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = fx - ix, ty = fy - iy, i = iy * (c + 1) + ix;
        n += w * ((v[i] * (1 - tx) + v[i + 1] * tx) * (1 - ty) + (v[i + c + 1] * (1 - tx) + v[i + c + 2] * tx) * ty);
      }
      out[y * MASK_W + x] = n;
    }
    const min = Math.min(...out), max = Math.max(...out);
    return out.map(n => (n - min) / (max - min));
  }
  const noise = makeTransitionNoise();
  const mask = document.createElement("canvas");
  mask.width = MASK_W;
  mask.height = MASK_H;
  const maskCtx = mask.getContext("2d"), maskImage = maskCtx.createImageData(MASK_W, MASK_H);
  const dissolve = document.createElement("canvas"), dissolveCtx = dissolve.getContext("2d");

  function snapshot(blank = false) {
    const copy = document.createElement("canvas");
    copy.width = Math.ceil(FW * renderScale);
    copy.height = Math.ceil(FH * renderScale);
    if (blank) {
      const g = copy.getContext("2d");
      g.fillStyle = BACKDROP;
      g.fillRect(0, 0, copy.width, copy.height);
      return copy;
    }
    copy.getContext("2d").drawImage(canvas, Math.round(FX * renderScale) + offsetX, Math.round(FY * renderScale) + offsetY,
      copy.width, copy.height, 0, 0, copy.width, copy.height);
    return copy;
  }

  function drawTransition(transition) {
    const t = Math.min(1, transition.age / config.animation.levelFade);
    const progress = t * t * (3 - 2 * t) * (1 + EDGE);
    for (let i = 0; i < noise.length; i++) {
      maskImage.data[i * 4 + 3] = 255 * Math.min(1, Math.max(0, (progress - noise[i]) / EDGE));
    }
    maskCtx.putImageData(maskImage, 0, 0);
    const from = transition.from;
    if (dissolve.width !== from.width || dissolve.height !== from.height) {
      dissolve.width = from.width;
      dissolve.height = from.height;
    }
    dissolveCtx.globalCompositeOperation = "copy";
    dissolveCtx.drawImage(from, 0, 0);
    dissolveCtx.globalCompositeOperation = "destination-out";
    dissolveCtx.imageSmoothingEnabled = true;
    dissolveCtx.drawImage(mask, 0, 0, from.width, from.height);
    ctx.drawImage(dissolve, FX, FY, FW, FH);
  }

  function draw(session, ui) {
    drawBackground(session.target);
    paintRenderer.render(session.cells, {
      target: session.target, time: ui.sceneTime, hovered: ui.hovered,
      interactive: !session.locked && !session.finished && !ui.paused
    });
    ctx.drawImage(paintRenderer.canvas, 0, 0, DW, DH);
    ctx.drawImage(assets.titleIcon, 61.33, 19.27, 34.24, 34.56);
    drawTopControls();
    for (const color of session.availableColors) drawOrb(color, session.selected);
    drawReset();
    drawGoal();
    if (session.finished) {
      ctx.save();
      const y = BY + GRID_H / 2;
      const shade = ctx.createLinearGradient(0, y - 48, 0, y + 48);
      shade.addColorStop(0, "#09161b00");
      shade.addColorStop(.3, "#09161be8");
      shade.addColorStop(.7, "#09161be8");
      shade.addColorStop(1, "#09161b00");
      ctx.fillStyle = shade;
      ctx.fillRect(BX, y - 48, GRID_W, 96);
      ctx.restore();
    }
    if (ui.transition) drawTransition(ui.transition);
    hud.draw(session, ui);
  }

  resize();
  return {draw, resize, snapshot};
}
