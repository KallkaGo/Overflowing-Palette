import $ from "jquery";
import {Config} from "./config.js";
import {levelData} from "../data/levels.js";
import {GameAudio} from "../audio/game-audio.js";
import {BLOCKED} from "./game/board.js";
import {Session} from "./game/session.js";
import {Dialogs} from "./ui/dialogs.js";
import {bindInput} from "./ui/input.js";
import {createCanvasView} from "./ui/canvas-view.js";
import {stageRect} from "./ui/stage.js";

/* 组装游戏会话、画面、输入、弹窗和音频。 */

export class Application {
  constructor() {
    this.config = Config;
    this.session = new Session(levelData, this.config.animation);
    this.canvas = $("#cv")[0];
    this.$status = $("#game-status");
    this.$loader = $("#loader");
    this.$bootMessage = $("#boot-message");
    this.$soundButton = $("#sound-toggle");
    this.$levelPicker = $("#level-picker");
    this.$levelButton = $("#level-button");
    this.$levelList = $("#level-list");
    this.audio = null;
    this.view = null;
    this.audioMuted = false;
    this.gestureSeen = false;
    this.advanceIn = 0;
    this.ui = {sceneTime: 0, hovered: -1, movePulse: 0, tipFlash: null, statusScale: 1};
    this.frame = this.frame.bind(this);
    this.dialogs = new Dialogs(
      $("#reset-dialog")[0], $("#info-dialog")[0], {
        pause: () => this.audio?.pause(), resume: () => this.audio?.resume()
      });
    this.input = bindInput(this.canvas, this.config.layout, this.session.cols, this.session.rows, {
      paused: () => this.dialogs.paused,
      availableColors: () => this.session.availableColors,
      cellEnabled: index => this.session.cells[index].color !== BLOCKED,
      interactive: () => Boolean(this.view) && !this.session.locked && !this.session.finished && !this.dialogs.paused,
      hover: index => { this.ui.hovered = index; },
      hoverSound: () => this.audio?.hover(),
      select: index => this.selectColor(index),
      selectRelative: delta => {
        if (this.session.selectRelative(delta)) this.audio?.selectColor();
        this.announce();
      },
      paint: index => this.paint(index),
      reset: () => this.requestReset(),
      info: kind => this.showInfo(kind),
      nextLevel: () => this.loadLevel(this.session.levelIndex + 1),
      toggleSound: () => this.toggleSound()
    });
    const unlock = () => {
      this.gestureSeen = true;
      this.audio?.unlock();
    };
    window.addEventListener("pointerdown", unlock, {capture: true});
    window.addEventListener("keydown", unlock, {capture: true});
    this.$soundButton.on("click", () => this.toggleSound());
    for (const [category, label] of [["world", "渐进练习"], ["activity", "溢彩画活动"]]) {
      this.$levelList.append($("<li>").attr("role", "presentation").addClass("level-group").text(label));
      this.session.catalog.levels.forEach((level, index) => {
        if (level.category !== category) return;
        $("<li>").attr({role: "option", "data-index": index}).text(level.name).appendTo(this.$levelList);
      });
    }
    this.bindLevelPicker();
    this.showCurrentLevel();
    this.announce();
  }

  statusMessage() {
    if (this.session.phase === "won") return "绘制完成";
    if (this.session.phase === "lost") return "步数用尽，按R重新绘制。";
    return "";
  }

  announce(message = this.statusMessage()) {
    const {session, config} = this;
    this.$status.text(session.level.name + "，剩余 " + session.movesLeft +
      " 步，已选" + config.palette[session.selected].name + "色，目标" +
      config.palette[session.target].name + "色。" + message);
  }

  loadLevel(index) {
    if (this.view) this.ui.transition = {from: this.view.snapshot(), age: 0};
    this.session.loadLevel(index);
    this.resetPresentation();
  }

  resetPresentation() {
    this.showCurrentLevel();
    this.advanceIn = 0;
    this.ui.movePulse = 0;
    this.ui.tipFlash = null;
    this.ui.statusScale = 1;
    this.input.clearHover();
    this.announce();
  }

  showCurrentLevel() {
    this.$levelButton.text(this.session.level.name);
    this.$levelList.children("[role=option]").each((_, item) => {
      item.setAttribute("aria-selected", String(Number(item.dataset.index) === this.session.levelIndex));
    });
  }

  bindLevelPicker() {
    const $button = this.$levelButton, $list = this.$levelList;
    const options = () => $list.children("[role=option]");
    let scrollTimer = 0, active = 0;
    const setActive = (position, scroll = true) => {
      active = Math.max(0, Math.min(options().length - 1, position));
      options().removeClass("active").eq(active).addClass("active");
      if (scroll) options()[active].scrollIntoView({block: "nearest"});
    };
    const open = () => {
      $list.prop("hidden", false);
      $button.attr("aria-expanded", "true");
      setActive(this.session.levelIndex, false);
      options()[active].scrollIntoView({block: "center"});
    };
    const close = () => {
      $list.prop("hidden", true);
      $button.attr("aria-expanded", "false");
    };
    const choose = position => {
      close();
      const index = Number(options()[position].dataset.index);
      if (index !== this.session.levelIndex) this.loadLevel(index);
    };
    $button.on("click", () => $list.prop("hidden") ? open() : close());
    $button.on("keydown", event => {
      if (event.key === "Escape" && !$list.prop("hidden")) { event.stopPropagation(); close(); return; }
      if ($list.prop("hidden")) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); open(); }
        return;
      }
      if (event.key === "ArrowDown") setActive(active + 1);
      else if (event.key === "ArrowUp") setActive(active - 1);
      else if (event.key === "Enter" || event.key === " ") choose(active);
      else return;
      event.preventDefault();
    });
    $list.on("click", "[role=option]", event => choose(options().index(event.currentTarget)));
    $list.on("pointermove", "[role=option]", event => setActive(options().index(event.currentTarget), false));
    $list.on("scroll", () => {
      $list.addClass("scrolling");
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => $list.removeClass("scrolling"), 700);
    });
    $(document).on("pointerdown", event => {
      if (!$list.prop("hidden") && !$(event.target).closest("#level-picker").length) close();
    });
  }

  selectColor(index) {
    if (this.session.selectColor(index)) this.audio?.selectColor();
    this.announce();
  }

  paint(index) {
    if (!this.view || this.dialogs.paused) return;
    const action = this.session.paint(index);
    if (action === "same-color") {
      this.ui.tipFlash = {text: "已经是这个颜色了", until: this.ui.sceneTime + 1.1};
      this.announce(this.ui.tipFlash.text);
    } else if (action === "painted") {
      this.ui.tipFlash = null;
      this.ui.movePulse = 1;
      this.announce();
    }
  }

  async requestReset() {
    if (this.session.movesLeft === this.session.moveBudget) return;
    const reset = await this.dialogs.confirmReset({currentBudget: this.session.moveBudget,
      nextBudget: this.session.level.moves + this.session.earnedBonus,
      baseMoves: this.session.level.moves, paintCount: this.session.paintCount});
    if (reset) {
      this.audio?.reset();
      this.session.reset(reset.claimBonus);
      this.resetPresentation();
    } else this.announce("已取消重置。");
  }

  async showInfo(kind) {
    await this.dialogs.showInfo(kind);
    this.announce();
  }

  toggleSound() {
    this.audioMuted = !this.audioMuted;
    this.audio?.setMuted(this.audioMuted);
    const label = this.audioMuted ? "开启声音（M）" : "静音（M）";
    this.$soundButton.attr({"aria-pressed": String(this.audioMuted), "aria-label": label, title: label});
  }

  resize() {
    this.view.resize();
    const rect = stageRect(this.canvas, this.config.layout);
    const {width, height, sound} = this.config.layout, scale = rect.width / width;
    this.$soundButton.css({
      left: rect.left + (sound.x - sound.size / 2) * scale,
      top: rect.top + (sound.y - sound.size / 2) * scale,
      width: sound.size * scale, height: sound.size * scale
    });
    const picker = this.config.layout.levelPicker;
    this.$levelPicker.css({
      left: rect.left + picker.x * scale, top: rect.top + picker.y * scale,
      width: picker.width * scale, fontSize: Math.max(12, 12 * scale) + "px"
    });
    this.$levelButton.css({height: Math.max(32, picker.height * scale), fontSize: Math.max(14, 14 * scale) + "px"});
    this.$levelList.css({fontSize: Math.max(14, 14 * scale) + "px"});
    this.draw();
  }

  draw() {
    this.view.draw(this.session, {...this.ui, paused: this.dialogs.paused});
  }

  frame(now) {
    const dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!this.dialogs.paused) {
      this.ui.sceneTime += dt;
      if (this.ui.transition && (this.ui.transition.age += dt) >= this.config.animation.levelFade) {
        this.ui.transition = null;
      }
      if (this.advanceIn > 0) {
        this.advanceIn = Math.max(0, this.advanceIn - dt);
        if (this.advanceIn === 0) this.loadLevel(this.session.levelIndex + 1);
      }
      const {waves, outcome} = this.session.update(dt);
      for (const order of waves) this.audio.paintWave(order);
      if (outcome) {
        if (outcome === "won") {
          this.ui.statusScale = .8;
          this.advanceIn = this.config.animation.completionHold;
          this.audio.success();
        }
        this.announce();
      }
      this.ui.movePulse = Math.max(0, this.ui.movePulse - dt / .25);
      if (this.session.finished) this.ui.statusScale += (1 - this.ui.statusScale) * Math.min(1, dt * 7);
      this.draw();
    }
    requestAnimationFrame(this.frame);
  }

  async start() {
    try {
      [this.view, this.audio] = await Promise.all([
        createCanvasView(this.canvas, this.config), GameAudio.create()
      ]);
      this.audio.setMuted(this.audioMuted);
      if (this.dialogs.paused) this.audio.pause();
      if (this.gestureSeen) this.audio.unlock();
      this.$soundButton.prop({disabled: false, hidden: false});
      this.$levelButton.prop("disabled", false);
      this.$levelPicker.prop("hidden", false);
      this.canvas.setAttribute("aria-busy", "false");
      this.resize();
      // 在加载画面仍覆盖页面时，完成首次渲染的着色器链接与纹理上传。
      this.ui.transition = {from: this.view.snapshot(true), age: 0};
      this.draw();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      this.draw();
      this.$loader.addClass("done");
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
      $(window).on("resize", () => this.resize());
      this.lastFrame = performance.now();
      requestAnimationFrame(this.frame);
      if (new URLSearchParams(location.search).has("demo")) {
        setTimeout(() => this.paint(4 * this.session.cols + 2), 700);
      }
    } catch (error) {
      this.canvas.setAttribute("aria-busy", "false");
      this.$loader.find(".loader-grid").prop("hidden", true);
      this.$bootMessage.attr("role", "alert").text("无法启动游戏：" + error.message);
      this.announce(this.$bootMessage.text());
      console.error(error);
    }
  }
}
