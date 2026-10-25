import {
  BufferAttribute, DynamicDrawUsage, InstancedBufferGeometry,
  InstancedInterleavedBuffer, InterleavedBufferAttribute, Mesh,
  OrthographicCamera, Scene, WebGLRenderer
} from "three";
import {PAINT_ANIMATION} from "../assets/paint-textures.js";
import {curve, encodeColor8, quantizeColor8} from "./animation-curves.js";
import {createPaintMaterial} from "./paint-material.js";

const TICKS = 24000;
const STRIDE = 12;
const MAX_LAYERS_PER_CELL = 6;

/** 使用一个有序实例流，保留原版每格的混合顺序。 */
export class PaintRenderer {
  static async create({width, height, geometry}) {
    const material = await createPaintMaterial(width, height, geometry.cw, geometry.ch);
    return new PaintRenderer(width, height, geometry, material);
  }

  constructor(width, height, geometry, material) {
    this.width = width;
    this.height = height;
    this.cellGeometry = geometry;
    this.material = material;
    this.renderer = new WebGLRenderer({
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false
    });
    this.canvas = this.renderer.domElement;
    this.renderer.setClearColor(0, 0);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(0, width, 0, height, 0, 2);
    this.camera.position.z = 1;
    this.geometry = new InstancedBufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 1, 0, 1, 0, 0, 1, 1, 0
    ]), 3));
    // 屏幕纵轴向下，因此需要反转三角形的顶点绕序。
    this.geometry.setIndex([0, 2, 1, 3, 5, 4]);
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.capacity = 0;
    this.resize(width, height);
  }

  reserve(cellCount) {
    const capacity = cellCount * MAX_LAYERS_PER_CELL;
    if (capacity <= this.capacity) return;
    // 替换属性前，先释放原有的 GPU 资源。
    if (this.capacity) this.geometry.dispose();
    this.capacity = capacity;
    this.instances = new InstancedInterleavedBuffer(new Float32Array(capacity * STRIDE), STRIDE);
    this.instances.setUsage(DynamicDrawUsage);
    for (const [index, name] of ["instanceRect", "instanceMaterial", "instanceState"].entries()) {
      this.geometry.setAttribute(name, new InterleavedBufferAttribute(this.instances, 4, index * 4));
    }
  }

  append(x, y, width, height, color, kind, maskScale, alpha, red = 1, blue = 0, dx = Math.SQRT1_2, dy = -Math.SQRT1_2) {
    this.instances.array.set([
      x, y, width, height, color, kind, maskScale, alpha, red, blue, dx, dy
    ], this.count++ * STRIDE);
  }

  appendBase(x, y, width, height, color, target) {
    this.append(x, y, width, height, color, 0, 1, 1);
    if (color === target) this.append(x, y, width, height, color + 4, 0, .985, 1);
  }

  appendCell(cell, target, hovered) {
    const geometry = this.cellGeometry;
    let x = geometry.x + cell.c * geometry.pitchX;
    let y = geometry.y + cell.r * geometry.pitchY;
    let width = geometry.cw, height = geometry.ch;
    if (cell.color === -1) {
      this.append(x, y, width, height, 0, 5, 1, 1);
      return;
    }
    const animation = cell.animation;
    if (!animation || animation.elapsed <= 0) {
      this.appendBase(x, y, width, height, animation ? cell.from : cell.color, target);
    } else {
      const sequence = PAINT_ANIMATION[animation.root ? "point" : "change"];
      const ticks = animation.elapsed * animation.rate * TICKS + (animation.root ? -4000 : 0);
      const scale = curve(ticks, sequence.scale);
      x += width * (1 - scale) / 2 + curve(ticks, sequence.x) * .4;
      y += height * (1 - scale) / 2 - curve(ticks, sequence.y) * .4;
      width *= scale;
      height *= scale;
      this.appendBase(x, y, width, height, animation.baseReady ? cell.color : cell.from, target);
      if (ticks < (animation.root ? 10000 : 13200)) {
        const angle = (animation.direction < 0 ? .125 : animation.direction) * Math.PI * 2;
        for (let kind = 1; kind <= 2; kind++) {
          const colors = sequence.colors[kind - 1];
          const childScale = kind === 1 ? .9885 : 1;
          const layer = cell.from + (cell.from === target ? 4 : 0);
          this.append(x + width * (1 - childScale) / 2, y + height * (1 - childScale) / 2,
            width * childScale, height * childScale, layer, kind, 1,
            quantizeColor8(curve(ticks, colors.AlphaCurve)),
            encodeColor8(curve(ticks, colors.RedCurve)), encodeColor8(curve(ticks, colors.BlueCurve)),
            Math.cos(angle), -Math.sin(angle));
        }
      }
      const lightAlpha = curve(ticks, sequence.lightAlpha);
      if (lightAlpha > 0) {
        const lightScale = curve(ticks, sequence.lightScale);
        this.append(x + width * (1 - lightScale) / 2, y + height * (1 - lightScale) / 2,
          width * lightScale, height * lightScale, 0, 3, 1, lightAlpha);
      }
    }
    if (hovered) this.append(x, y, width, height, 0, 4, 1, 1);
  }

  resize(pixelWidth, pixelHeight) {
    this.renderer.setSize(pixelWidth, pixelHeight, false);
    this.material.uniforms.pixelSize.value.set(this.width / pixelWidth, this.height / pixelHeight);
  }

  render(cells, {target, time, hovered, interactive}) {
    this.reserve(cells.length);
    this.count = 0;
    cells.forEach((cell, index) => this.appendCell(cell, target, interactive && index === hovered));
    this.geometry.instanceCount = this.count;
    this.instances.clearUpdateRanges();
    this.instances.addUpdateRange(0, this.count * STRIDE);
    this.instances.needsUpdate = true;
    this.material.uniforms.time.value = time;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    for (const {value} of Object.values(this.material.uniforms)) {
      if (value?.isTexture) value.dispose();
    }
    this.material.dispose();
    this.renderer.dispose();
  }
}
