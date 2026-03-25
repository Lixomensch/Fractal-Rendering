const IS_LITTLE_ENDIAN = (() => {
  const buffer = new ArrayBuffer(4);
  new Uint32Array(buffer)[0] = 0x01020304;
  return new Uint8Array(buffer)[0] === 0x04;
})();

let paletteLookup = new Uint8ClampedArray(0);
let palette32 = new Uint32Array(0);
const bufferPool = new Map();

function acquireBuffer(byteLength) {
  const available = bufferPool.get(byteLength);
  if (available && available.length > 0) {
    return available.pop();
  }
  return new ArrayBuffer(byteLength);
}

function recycleBuffer(buffer) {
  if (!(buffer instanceof ArrayBuffer)) {
    return;
  }

  const key = buffer.byteLength;
  if (!bufferPool.has(key)) {
    bufferPool.set(key, []);
  }
  bufferPool.get(key).push(buffer);
}

function buildPalette32FromLookup(lookup) {
  const size = Math.max(1, Math.floor(lookup.length / 3));
  const packed = new Uint32Array(size);

  for (let i = 0; i < size; i++) {
    const index = i * 3;
    const r = lookup[index];
    const g = lookup[index + 1];
    const b = lookup[index + 2];
    const a = 255;

    packed[i] = IS_LITTLE_ENDIAN
      ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
      : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  }

  return packed;
}

function renderSegment(params) {
  const {
    frameId,
    startX,
    endX,
    width,
    height,
    zoom,
    offsetX,
    offsetY,
    maxIteration,
    constantRe,
    constantIm,
  } = params;

  const segmentWidth = endX - startX;
  const byteLength = segmentWidth * height * 4;
  const buffer = acquireBuffer(byteLength);
  const pixels32 = new Uint32Array(buffer);

  const paletteSize = Math.max(1, palette32.length);
  const paletteLastIndex = paletteSize - 1;
  const inverseMaxIteration = 1 / maxIteration;
  const scaleX = 4 / (width * zoom);
  const scaleY = 4 / (height * zoom);
  const startRe = -2 / zoom + offsetX;
  const startIm = -2 / zoom + offsetY;
  const segmentStartRe = startRe + startX * scaleX;

  for (let y = 0; y < height; y++) {
    const zy = y * scaleY + startIm;
    let zx = segmentStartRe;

    for (let localX = 0; localX < segmentWidth; localX++) {
      let currentZx = zx;
      let currentZy = zy;
      let iteration = 0;
      let squaredMagnitude = 0;

      while (iteration < maxIteration) {
        const zx2 = currentZx * currentZx;
        const zy2 = currentZy * currentZy;
        squaredMagnitude = zx2 + zy2;

        if (squaredMagnitude > 4) {
          break;
        }

        currentZy = 2 * currentZx * currentZy + constantIm;
        currentZx = zx2 - zy2 + constantRe;
        iteration += 1;
      }

      let colorIndex = 0;
      if (iteration >= maxIteration) {
        colorIndex = paletteLastIndex;
      } else {
        const smooth = iteration - 0.5 * Math.log(Math.max(squaredMagnitude, 1)) * Math.LOG2E;
        const normalized = smooth * inverseMaxIteration;
        const clamped = normalized <= 0 ? 0 : normalized >= 1 ? 1 : normalized;
        colorIndex = (clamped * paletteLastIndex) | 0;
      }

      const pixelOffset = y * segmentWidth + localX;
      pixels32[pixelOffset] = palette32[colorIndex];
      zx += scaleX;
    }
  }

  self.postMessage(
    {
      type: "renderResult",
      frameId,
      startX,
      endX,
      pixels: buffer,
    },
    [buffer]
  );
}

self.onmessage = (event) => {
  const message = event.data;

  if (message.type === "init") {
    paletteLookup = new Uint8ClampedArray(message.paletteLookup);
    palette32 = buildPalette32FromLookup(paletteLookup);
    return;
  }

  if (message.type === "render") {
    renderSegment(message);
    return;
  }

  if (message.type === "recycle") {
    recycleBuffer(message.buffer);
  }
};
