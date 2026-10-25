import {
  AddEquation, CustomBlending, DataArrayTexture, GLSL3, LinearFilter,
  OneFactor, OneMinusSrcAlphaFactor, RawShaderMaterial, SRGBColorSpace,
  Texture, Vector2
} from "three";
import {PAINT_TEXTURES} from "../assets/paint-textures.js";
import {loadImage} from "../src/tools/image-loader.js";

const VERTEX = `
precision highp float;
in vec3 position;
in vec4 instanceRect;
in vec4 instanceMaterial;
in vec4 instanceState;
uniform vec2 referenceSize;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
out vec2 localUV;
out vec2 screenUV;
flat out vec4 material;
flat out vec4 state;
void main() {
    localUV = position.xy;
    vec2 point = instanceRect.xy + localUV * instanceRect.zw;
    screenUV = point / referenceSize;
    material = instanceMaterial;
    state = instanceState;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
precision highp sampler2DArray;
in vec2 localUV;
in vec2 screenUV;
flat in vec4 material;
flat in vec4 state;
uniform sampler2DArray paintTextures;
uniform sampler2D pointMask;
uniform sampler2D pointLight;
uniform sampler2D flowNoise3;
uniform sampler2D flowNoise6;
uniform sampler2D localNoise10;
uniform sampler2D lockedTexture;
uniform float time;
uniform vec2 cellSize;
uniform vec2 pixelSize;
out vec4 outColor;

float roundedBox(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - radius;
}

void main() {
    int kind = int(material.y);
    if (kind == 5) {
        vec4 locked = texture(lockedTexture,localUV);
        outColor = vec4(locked.rgb*locked.a,locked.a);
        return;
    }
    if (kind == 3) {
        vec4 light = texture(pointLight,localUV);
        // BtnLeftPointLattice 的 AniLight2 / AniLight3 控件使用 FColor，BGRA 字节为 95 D6 FF FF。
        vec3 lightTint = vec3(255.0,214.0,149.0)/255.0;
        // MI_Add：对 RGB 做加法叠加，不增加目标透明度。
        outColor = vec4(light.rgb * lightTint * light.a * material.w,0.0);
        return;
    }
    if (kind == 4) {
        // 轮廓与 T_PointMask（132px）一致：内缩 3px，圆角半径 20px。
        float distance = abs(roundedBox((localUV-0.5)*cellSize,cellSize*(0.5-3.0/132.0),cellSize.x*20.0/132.0));
        float alpha = (1.0-smoothstep(0.5-pixelSize.y*0.6,0.5+pixelSize.y*0.6,distance))*0.5;
        outColor = vec4(vec3(238.0,247.0,238.0)/255.0*alpha,alpha);
        return;
    }
    vec2 clipUV = (localUV-0.5)/material.z+0.5;
    float clipMask = texture(pointMask,clipUV).r;
    if (any(lessThan(clipUV,vec2(0.0))) || any(greaterThan(clipUV,vec2(1.0)))) clipMask=0.0;

    // 在完整视口的 UV 坐标中，两个轴使用相同的红通道偏移量。
    vec2 noiseUV = screenUV+time*0.01;
    float flow = kind == 1 ? texture(flowNoise6,noiseUV).r : texture(flowNoise3,noiseUV).r;
    vec4 texel = texture(paintTextures,vec3(screenUV+flow*0.1,material.x));
    float mask = 1.0;
    vec3 rgb = texel.rgb;
    if (kind == 1 || kind == 2) {
        float k = kind == 1 ? 10.0 : 4.0;
        float inverseK = 1.0/k;
        float span = 2.0+2.0*inverseK;
        float noise = texture(localNoise10,localUV*0.790477).r;
        float linearMask = clamp(k*(dot(localUV-0.5,state.zw)+0.5+inverseK-span*(1.0-state.x)+noise),0.0,1.0);
        float radialMask = clamp(k*(length(localUV-0.5)+inverseK-span*state.y+noise),0.0,1.0);
        // 可操作棋盘的 MPC.ScreenFadeInoutProgress 为 1，因此 S=1。
        mask = linearMask*radialMask;
        vec3 edge = kind == 1 ? vec3(0.351533,1.0,0.351533) : vec3(0.617207,1.0,0.520996);
        rgb += (1.0-mask)*edge;
    }
    float alpha = clamp(mask*texel.a*clipMask*material.w,0.0,1.0);
    // PNG 采样值已使用显示编码，不再重复应用伽马曲线。
    // Down 将父级混合模式覆写为 BLEND_Additive；Up 使用半透明混合。
    outColor = vec4(rgb*alpha,kind == 1 ? 0.0 : alpha);
}`;

// 彩色 PNG 保留显示编码；只有遮罩和噪声按 sRGB 解码。
function textureFromImage(image, srgb = false) {
  const texture = new Texture(image);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = LinearFilter;
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function paintTextureArray(images) {
  const {width, height} = images[0];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", {willReadFrequently: true});
  const layerSize = width * height * 4;
  const pixels = new Uint8Array(layerSize * images.length);
  images.forEach((image, layer) => {
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    pixels.set(context.getImageData(0, 0, width, height).data, layer * layerSize);
  });
  const texture = new DataArrayTexture(pixels, width, height, images.length);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export async function createPaintMaterial(width, height, cellWidth, cellHeight) {
  const colors = ["Blue", "Red", "Yellow", "Green"];
  const names = [
    ...colors.map(color => "T_BgTexture" + color + "Nor"),
    ...colors.map(color => "T_BgTexture" + color),
    "T_PointMask", "T_PointLight", "T_Noise_3", "T_Noise_6", "T_Noise_10", "T_BgTextureLock"
  ];
  const images = await Promise.all(names.map(name => loadImage(PAINT_TEXTURES[name])));
  const uniforms = {
    referenceSize: {value: new Vector2(width, height)},
    cellSize: {value: new Vector2(cellWidth, cellHeight)},
    pixelSize: {value: new Vector2(1, 1)},
    time: {value: 0},
    paintTextures: {value: paintTextureArray(images.slice(0, 8))}
  };
  const samplers = ["pointMask", "pointLight", "flowNoise3", "flowNoise6", "localNoise10", "lockedTexture"];
  samplers.forEach((name, index) => {
    uniforms[name] = {value: textureFromImage(images[index + 8], name !== "pointLight" && name !== "lockedTexture")};
  });
  return new RawShaderMaterial({
    name: "LifePoint paint",
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor
  });
}
