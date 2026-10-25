import $ from "jquery";
import {stageRect} from "./stage.js";

/* 将浏览器输入转换为游戏动作，此模块不处理玩法规则。 */

export function bindInput(canvas, layout, cols, rows, actions) {
  const {board, orbs} = layout;
  let lastAudioHover = "";

  function point(event) {
    const rect = stageRect(canvas, layout);
    return {x: (event.clientX - rect.left) / rect.width * layout.width,
      y: (event.clientY - rect.top) / rect.height * layout.height};
  }

  function cellAt({x, y}) {
    const col = Math.floor((x - board.x) / board.pitchX);
    const row = Math.floor((y - board.y) / board.pitchY);
    if (row < 0 || row >= rows || col < 0 || col >= cols) return -1;
    if (x - board.x - col * board.pitchX > board.cellWidth ||
        y - board.y - row * board.pitchY > board.cellHeight) return -1;
    return row * cols + col;
  }

  function controlAt({x, y}) {
    for (let i = 0; i < 4; i++) {
      if (actions.colorAvailable(i) && Math.hypot(x - orbs.x, y - (orbs.y + i * orbs.step)) <= 34) return "orb" + i;
    }
    for (const name of ["previous", "next"]) {
      const cue = layout.paletteCues[name];
      if (x >= cue.x && x <= cue.x + cue.width && y >= cue.y && y <= cue.y + cue.height) return name;
    }
    if (Math.hypot(x - 942, y - 500) <= 25 || (Math.abs(x - 942) < 25 && y >= 527 && y <= 549)) return "reset";
    if (Math.hypot(x - 1116, y - 35) <= 17) return "help";
    if (Math.hypot(x - 1186, y - 35) <= 21) return "pause";
    return "";
  }

  function clearHover() {
    lastAudioHover = "";
    actions.hover(-1);
  }

  $(canvas).on("pointermove", event => {
    const position = point(event), cell = cellAt(position), control = controlAt(position);
    const enabled = cell >= 0 && actions.cellEnabled(cell);
    actions.hover(enabled ? cell : -1);
    const audioHover = enabled ? "cell" + cell : control.startsWith("orb") ? control : "";
    if (audioHover && audioHover !== lastAudioHover && actions.interactive()) actions.hoverSound();
    lastAudioHover = audioHover;
    canvas.style.cursor = control || enabled ? "pointer" : "default";
  });
  $(canvas).on("pointerleave", clearHover);
  $(canvas).on("pointerdown", event => {
    if (actions.paused()) return;
    const position = point(event), control = controlAt(position);
    if (control.startsWith("orb")) actions.select(Number(control.slice(3)));
    else if (control === "previous") actions.selectRelative(-1);
    else if (control === "next") actions.selectRelative(1);
    else if (control === "reset") actions.reset();
    else if (control === "help" || control === "pause") actions.info(control);
    else {
      const cell = cellAt(position);
      if (cell >= 0) actions.paint(cell);
    }
  });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    if (!actions.paused()) actions.selectRelative(event.deltaY > 0 ? 1 : -1);
  }, {passive: false});
  $(window).on("keydown", event => {
    if (actions.paused() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.closest("select,input,textarea,#level-picker")) return;
    const key = event.key.toLowerCase();
    if (key >= "1" && key <= "4") actions.select(Number(key) - 1);
    else if (key === "m") actions.toggleSound();
    else if (key === "r") actions.reset();
    else if (key === "n") actions.nextLevel();
    else if (key === "arrowup" || key === "arrowdown") {
      event.preventDefault();
      actions.selectRelative(key === "arrowup" ? -1 : 1);
    } else if (key === "?" || key === "f1") {
      event.preventDefault();
      actions.info("help");
    } else if (key === "escape") {
      event.preventDefault();
      actions.info("pause");
    }
  });

  return {clearHover};
}
