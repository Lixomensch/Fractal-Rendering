const DEFAULT_PALETTE_STOPS = [
  { value: 0.0, color: { r: 25, g: 24, b: 23 } },
  { value: 0.03, color: { r: 120, g: 90, b: 70 } },
  { value: 0.05, color: { r: 130, g: 24, b: 23 } },
  { value: 0.25, color: { r: 250, g: 179, b: 100 } },
  { value: 0.5, color: { r: 43, g: 65, b: 98 } },
  { value: 0.85, color: { r: 11, g: 110, b: 79 } },
  { value: 0.95, color: { r: 150, g: 110, b: 79 } },
  { value: 1.0, color: { r: 255, g: 255, b: 255 } },
];

class Palette {
  constructor(stops = DEFAULT_PALETTE_STOPS, resolution = 1024) {
    this.stops = [...stops].sort((a, b) => a.value - b.value);
    this.resolution = resolution;
    this.lookup = this.#buildLookup();
  }

  #buildLookup() {
    const lookup = new Uint8ClampedArray(this.resolution * 3);
    for (let i = 0; i < this.resolution; i++) {
      const value = i / (this.resolution - 1);
      const { r, g, b } = this.#sample(value);
      const index = i * 3;
      lookup[index] = r;
      lookup[index + 1] = g;
      lookup[index + 2] = b;
    }
    return lookup;
  }

  #sample(value) {
    if (value <= this.stops[0].value) {
      return this.stops[0].color;
    }
    if (value >= this.stops[this.stops.length - 1].value) {
      return this.stops[this.stops.length - 1].color;
    }

    for (let i = 1; i < this.stops.length; i++) {
      if (this.stops[i].value > value) {
        const lower = this.stops[i - 1];
        const upper = this.stops[i];
        const ratio = (value - lower.value) / (upper.value - lower.value);

        return {
          r: Math.round((1 - ratio) * lower.color.r + ratio * upper.color.r),
          g: Math.round((1 - ratio) * lower.color.g + ratio * upper.color.g),
          b: Math.round((1 - ratio) * lower.color.b + ratio * upper.color.b),
        };
      }
    }

    return this.stops[this.stops.length - 1].color;
  }

  getLookup() {
    return this.lookup;
  }
}

class FractalState {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.maxIteration = 500;
    this.zoom = 1.3;
    this.offsetX = 0;
    this.offsetY = 0;
    this.constant = {
      re: -0.8,
      im: 0.156,
    };
  }

  setCanvasSize(width, height) {
    this.width = width;
    this.height = height;
  }

  screenToComplex(screenX, screenY) {
    const re = (screenX / this.width) * (4 / this.zoom) - 2 / this.zoom + this.offsetX;
    const im = (screenY / this.height) * (4 / this.zoom) - 2 / this.zoom + this.offsetY;
    return { re, im };
  }

  zoomAt(screenX, screenY, zoomFactor) {
    const before = this.screenToComplex(screenX, screenY);
    this.zoom *= zoomFactor;
    const after = this.screenToComplex(screenX, screenY);

    this.offsetX += before.re - after.re;
    this.offsetY += before.im - after.im;
  }

  panByPixels(dx, dy) {
    this.offsetX -= (dx * 4) / (this.width * this.zoom);
    this.offsetY -= (dy * 4) / (this.height * this.zoom);
  }

  snapshot(frameId) {
    return {
      frameId,
      width: this.width,
      height: this.height,
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      maxIteration: this.maxIteration,
      constantRe: this.constant.re,
      constantIm: this.constant.im,
    };
  }
}

class WorkerPool {
  constructor(workerUrl, workerCount, paletteLookup) {
    this.workers = Array.from({ length: workerCount }, (_, workerIndex) => {
      const worker = new Worker(workerUrl);
      worker.addEventListener("message", (event) => {
        this.#handleWorkerMessage(workerIndex, event.data);
      });
      worker.postMessage({
        type: "init",
        paletteLookup,
      });
      return worker;
    });

    this.currentFrameParams = null;
    this.currentOnSegment = null;
    this.currentResolve = null;
    this.taskQueue = [];
    this.taskCursor = 0;
    this.inFlightCount = 0;
  }

  #buildTasks(width) {
    const tasks = [];
    const targetTaskCount = this.workers.length * 6;
    const chunkWidth = Math.min(256, Math.max(32, Math.ceil(width / targetTaskCount)));

    for (let startX = 0; startX < width; startX += chunkWidth) {
      tasks.push({
        startX,
        endX: Math.min(startX + chunkWidth, width),
      });
    }

    return tasks;
  }

  #dispatchNextTask(workerIndex) {
    if (!this.currentFrameParams || this.taskCursor >= this.taskQueue.length) {
      return;
    }

    const task = this.taskQueue[this.taskCursor];
    this.taskCursor += 1;

    if (!task) {
      return;
    }

    this.inFlightCount += 1;

    this.workers[workerIndex].postMessage({
      type: "render",
      ...this.currentFrameParams,
      startX: task.startX,
      endX: task.endX,
    });
  }

  #handleWorkerMessage(workerIndex, message) {
    if (!message || message.type !== "renderResult") {
      return;
    }

    if (!this.currentFrameParams || message.frameId !== this.currentFrameParams.frameId) {
      if (message.pixels instanceof ArrayBuffer) {
        this.recycleBuffer(workerIndex, message.pixels);
      }
      return;
    }

    this.inFlightCount = Math.max(0, this.inFlightCount - 1);

    if (this.currentOnSegment) {
      this.currentOnSegment({
        ...message,
        workerIndex,
      });
    }

    this.#dispatchNextTask(workerIndex);

    if (this.taskCursor >= this.taskQueue.length && this.inFlightCount === 0) {
      const resolve = this.currentResolve;

      this.currentFrameParams = null;
      this.currentOnSegment = null;
      this.currentResolve = null;
      this.taskQueue = [];
      this.taskCursor = 0;

      if (resolve) {
        resolve();
      }
    }
  }

  renderFrame(params, onSegment) {
    const { width } = params;
    const tasks = this.#buildTasks(width);

    return new Promise((resolve) => {
      if (tasks.length === 0) {
        resolve();
        return;
      }

      this.currentFrameParams = params;
      this.currentOnSegment = onSegment;
      this.currentResolve = resolve;
      this.taskQueue = tasks;
      this.taskCursor = 0;
      this.inFlightCount = 0;

      for (let i = 0; i < this.workers.length; i++) {
        this.#dispatchNextTask(i);
      }
    });
  }

  recycleBuffer(workerIndex, buffer) {
    if (workerIndex < 0 || workerIndex >= this.workers.length || !(buffer instanceof ArrayBuffer)) {
      return;
    }

    this.workers[workerIndex].postMessage(
      {
        type: "recycle",
        buffer,
      },
      [buffer]
    );
  }

  terminate() {
    this.workers.forEach((worker) => worker.terminate());
  }
}

class AdaptiveIterationController {
  constructor({ hysteresisRatio = 0.14 } = {}) {
    this.hysteresisRatio = hysteresisRatio;
    this.currentBandIndex = -1;

    this.bands = [
      { maxZoom: 1.4, ratio: 0.58, minIterations: 96 },
      { maxZoom: 2.6, ratio: 0.68, minIterations: 120 },
      { maxZoom: 5.5, ratio: 0.78, minIterations: 160 },
      { maxZoom: 12, ratio: 0.88, minIterations: 220 },
      { maxZoom: 24, ratio: 0.95, minIterations: 280 },
      { maxZoom: Number.POSITIVE_INFINITY, ratio: 1.0, minIterations: 320 },
    ];
  }

  setHysteresisRatio(nextRatio) {
    this.hysteresisRatio = Math.min(0.5, Math.max(0.01, Number(nextRatio) || 0.14));
    this.currentBandIndex = -1;
  }

  #findBandIndex(zoom) {
    for (let i = 0; i < this.bands.length; i++) {
      if (zoom <= this.bands[i].maxZoom) {
        return i;
      }
    }
    return this.bands.length - 1;
  }

  #bandBounds(index) {
    const minZoom = index === 0 ? 0 : this.bands[index - 1].maxZoom;
    const maxZoom = this.bands[index].maxZoom;
    return { minZoom, maxZoom };
  }

  #updateBandWithHysteresis(zoom) {
    if (this.currentBandIndex < 0) {
      this.currentBandIndex = this.#findBandIndex(zoom);
      return;
    }

    const { minZoom, maxZoom } = this.#bandBounds(this.currentBandIndex);
    const lowerLimit = minZoom <= 0 ? 0 : minZoom * (1 - this.hysteresisRatio);
    const upperLimit = Number.isFinite(maxZoom)
      ? maxZoom * (1 + this.hysteresisRatio)
      : Number.POSITIVE_INFINITY;

    if (zoom < lowerLimit || zoom > upperLimit) {
      this.currentBandIndex = this.#findBandIndex(zoom);
    }
  }

  getEffectiveIteration(zoom, userMaxIteration) {
    const maxIteration = Math.max(1, Math.floor(userMaxIteration));
    this.#updateBandWithHysteresis(zoom);

    const band = this.bands[this.currentBandIndex];
    const minFloor = Math.min(maxIteration, band.minIterations);
    const scaled = Math.round(maxIteration * band.ratio);

    return Math.max(minFloor, Math.min(maxIteration, scaled));
  }
}

export class FractalRenderer {
  constructor(
    canvas,
    {
      workerScriptUrl,
      workerCount,
      adaptiveIterationsEnabled = false,
      adaptiveHysteresisRatio = 0.14,
    }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

    this.palette = new Palette(DEFAULT_PALETTE_STOPS, 1024);

    this.state = new FractalState(1, 1);
    this.imageData = this.ctx.createImageData(1, 1);

    this.pool = new WorkerPool(workerScriptUrl, workerCount, this.palette.getLookup());
    this.adaptiveHysteresisRatio = adaptiveHysteresisRatio;
    this.adaptiveIterations = adaptiveIterationsEnabled
      ? new AdaptiveIterationController({ hysteresisRatio: this.adaptiveHysteresisRatio })
      : null;

    this.frameId = 0;
    this.isRendering = false;
    this.needsRender = false;
  }

  setAdaptiveIterationsEnabled(enabled) {
    if (enabled) {
      if (!this.adaptiveIterations) {
        this.adaptiveIterations = new AdaptiveIterationController({
          hysteresisRatio: this.adaptiveHysteresisRatio,
        });
      }
      return;
    }

    this.adaptiveIterations = null;
  }

  setAdaptiveHysteresisRatio(ratio) {
    const parsed = Number.parseFloat(ratio);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.adaptiveHysteresisRatio = Math.min(0.5, Math.max(0.01, parsed));
    if (this.adaptiveIterations) {
      this.adaptiveIterations.setHysteresisRatio(this.adaptiveHysteresisRatio);
    }
  }

  resize(width, height) {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));

    if (this.state.width === nextWidth && this.state.height === nextHeight) {
      return;
    }

    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;

    this.state.setCanvasSize(nextWidth, nextHeight);
    this.imageData = this.ctx.createImageData(nextWidth, nextHeight);

    // Invalidate in-flight frame results after a size change.
    this.frameId += 1;
  }

  requestRender() {
    if (this.isRendering) {
      this.needsRender = true;
      return;
    }

    this.#render();
  }

  async #render() {
    this.isRendering = true;

    const frameId = ++this.frameId;
    const snapshot = this.state.snapshot(frameId);

    if (this.adaptiveIterations) {
      snapshot.maxIteration = this.adaptiveIterations.getEffectiveIteration(
        snapshot.zoom,
        snapshot.maxIteration
      );
    }

    const target = this.imageData.data;
    const target32 = new Uint32Array(target.buffer);

    await this.pool.renderFrame(snapshot, ({ frameId: resultFrameId, startX, endX, pixels, workerIndex }) => {
      if (resultFrameId !== this.frameId) {
        return;
      }

      const segment32 = new Uint32Array(pixels);
      const segmentWidth = endX - startX;

      for (let y = 0; y < snapshot.height; y++) {
        const sourceStart = y * segmentWidth;
        const targetStart = y * snapshot.width + startX;

        for (let i = 0; i < segmentWidth; i++) {
          target32[targetStart + i] = segment32[sourceStart + i];
        }
      }
      this.pool.recycleBuffer(workerIndex, pixels);
    });

    if (frameId === this.frameId) {
      this.ctx.putImageData(this.imageData, 0, 0);
    }

    this.isRendering = false;
    if (this.needsRender) {
      this.needsRender = false;
      this.requestRender();
    }
  }

  destroy() {
    this.pool.terminate();
  }
}
