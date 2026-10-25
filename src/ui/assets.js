import {loadImage} from "../tools/image-loader.js";
import {Config} from "../config.js";
import {PAINT_TEXTURES} from "../../assets/paint-textures.js";
import {LIFEPOINT_FONT} from "../../assets/game-font.js";
import {imageUrls} from "./image-urls.js";

function redMask(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let p = 0; p < pixels.data.length; p += 4) {
    pixels.data[p + 3] = pixels.data[p];
    pixels.data[p] = pixels.data[p + 1] = pixels.data[p + 2] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function tint(image, color) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function loadAssets(palette) {
  const [normal, frames, boardBackground, circle, arrow, ornaments, masks, trim, font] = await Promise.all([
    Promise.all(palette.map(color => loadImage(PAINT_TEXTURES["T_BgTexture" + color.texture + "Nor"]))),
    Promise.all(palette.map(color => loadImage(imageUrls.frames[color.frame]))),
    loadImage(imageUrls.boardBackground), loadImage(PAINT_TEXTURES.T_CircleMask),
    loadImage(imageUrls.arrow),
    Promise.all(imageUrls.ornaments.map(loadImage)),
    Promise.all(imageUrls.masks.map(loadImage)),
    Promise.all([imageUrls.titleIcon, imageUrls.footerTrim].map(loadImage)),
    new FontFace("LifePointGame", "url(" + LIFEPOINT_FONT + ")").load()
  ]);
  document.fonts.add(font);
  const [titleIcon, footerTrim] = trim;
  return {normal, frames, boardBackground, circle: redMask(circle), arrow, ornaments, masks,
    titleIcon: tint(titleIcon, Config.theme.titleTint), footerTrim};
}
