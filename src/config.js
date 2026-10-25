export const Config = Object.freeze({
  palette: [
    {name: "蓝", hex: "#5f8abc", pigment: "#63a6d1", texture: "Blue", frame: "Blie"},
    {name: "红", hex: "#c14f4e", pigment: "#c6443e", texture: "Red", frame: "Red"},
    {name: "黄", hex: "#e0cc8b", pigment: "#ceb86e", texture: "Yellow", frame: "Yellow"},
    {name: "绿", hex: "#61a690", pigment: "#549e8f", texture: "Green", frame: "Green"}
  ],
  layout: {
    width: 1280, height: 576,
    // 原版 Prefab：单格 132²，格距 134×135，容器 1340×1080，缩放比例 0.4。
    board: {x: 337, y: 75, cellWidth: 52.8, cellHeight: 52.8,
      pitchX: 53.6, pitchY: 54, width: 536, height: 432},
    orbs: {x: 942, y: 135, step: 80, radius: 30},
    paletteCues: {
      previous: {x: 928.4, y: 61.2015625, width: 25.6, height: 36.8},
      next: {x: 932.4, y: 425.9914551, width: 17.6, height: 44.8}
    },
    footer: {
      trim: {x: 721.6, y: 457.9999, width: 193.6, height: 100.8},
      dot: {x: 720, y: 530.7999, width: 20, height: 20}
    },
    sound: {x: 1048, y: 35, size: 30},
    levelPicker: {x: 68, y: 120, width: 204, height: 36}
  },
  theme: {
    gold: "#bfb47e", white: "#f3f5e8",
    font: '"LifePointGame", sans-serif',
    titleTint: "#aa9b6a", stepColor: "#ffcb3f", dangerStepColor: "#ff7d6e",
    dotTint: "#94844c",
    // 根据截图校准显示效果，此值不是原版材质参数。
    pigmentTextureWeight: .2
  },
  animation: {
    ticksPerSecond: 24000,
    changeEnd: 14000,
    pointStart: -4000,
    pointEnd: 10800,
    completionHold: 1.7,
    levelFade: .9
  }
});
