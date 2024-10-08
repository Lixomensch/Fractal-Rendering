const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let maxIteration = 500;
let zoom = 1.3;
let offsetX = 0.0;
let offsetY = 0.0;
let constant = [-0.8, 0.156];
let variableC = false;

const palette = [
  { value: 0.0, color: { r: 25, g: 24, b: 23 } },
  { value: 0.03, color: { r: 120, g: 90, b: 70 } },
  { value: 0.05, color: { r: 130, g: 24, b: 23 } },
  { value: 0.25, color: { r: 250, g: 179, b: 100 } },
  { value: 0.5, color: { r: 43, g: 65, b: 98 } },
  { value: 0.85, color: { r: 11, g: 110, b: 79 } },
  { value: 0.95, color: { r: 150, g: 110, b: 79 } },
  { value: 1.0, color: { r: 255, g: 255, b: 255 } },
];

function getColorFromPalette(value) {
  if (value >= 1.0) {
    return palette[palette.length - 1].color;
  } else if (value <= 0.0) {
    return palette[0].color;
  }
  for (let i = 1; i < palette.length; i++) {
    if (palette[i].value > value) {
      const lower = palette[i - 1];
      const upper = palette[i];
      const range = upper.value - lower.value;
      const ratio = (value - lower.value) / range;
      return {
        r: Math.floor((1 - ratio) * lower.color.r + ratio * upper.color.r),
        g: Math.floor((1 - ratio) * lower.color.g + ratio * upper.color.g),
        b: Math.floor((1 - ratio) * lower.color.b + ratio * upper.color.b),
      };
    }
  }
  return { r: 255, g: 255, b: 255 };
}

const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8);
const workers = Array.from({ length: workerCount }, () => new Worker("worker.js"));

let imageData = ctx.createImageData(canvas.width, canvas.height);

function renderJulia() {
  const segmentWidth = Math.ceil(canvas.width / workerCount);

  const data = imageData.data;
  let completedWorkers = 0;

  for (let i = 0; i < workerCount; i++) {
    const worker = workers[i];

    worker.onmessage = function (event) {
      const result = event.data;

      for (let j = 0; j < result.length; j++) {
        const { x, y, i } = result[j];
        const normalizedIter = i / maxIteration;
        const color = getColorFromPalette(normalizedIter);
        const index = (y * canvas.width + x) * 4;
        data[index] = color.r;
        data[index + 1] = color.g;
        data[index + 2] = color.b;
        data[index + 3] = 255;
      } 

      completedWorkers++;
      if (completedWorkers === workerCount) {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    worker.postMessage({
      startX: i * segmentWidth,
      endX: Math.min((i + 1) * segmentWidth, canvas.width),
      width: canvas.width,
      height: canvas.height,
      zoom: zoom,
      offsetX: offsetX,
      offsetY: offsetY,
      maxIteration: maxIteration,
      constant: constant,
    });
  }
}

canvas.addEventListener("wheel", (event) => {
  zoom *= event.deltaY < 0 ? 1.1 : 0.9;
  renderJulia();
});

let isDragging = false;
let startX, startY;

canvas.addEventListener("mousedown", (event) => {
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
});

canvas.addEventListener("mousemove", (event) => {
  if (isDragging) {
    let dx = (((event.clientX - startX) / canvas.width) * 4.0) / zoom;
    let dy = (((event.clientY - startY) / canvas.height) * 4.0) / zoom;
    offsetX -= dx;
    offsetY -= dy;
    startX = event.clientX;
    startY = event.clientY;
    renderJuliaDebounced();
  }
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("resize", (event) => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  imageData = ctx.createImageData(canvas.width, canvas.height);
  renderJulia();
});

const renderJuliaDebounced = debounce(renderJulia, 50);

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const applyChanges = document.getElementById("applyChanges");

applyChanges.addEventListener("click", (event) => {
    maxIteration = document.getElementById("iterations").value;
    const constantReal = document.getElementById("cR").value;
    const constantImaginary = document.getElementById("cI").value;
    variableC = document.getElementById("variableC").checked;
    startConstantVariation();
    stopConstantVariation();

    constant[0] = parseFloat(constantReal);
    constant[1] = parseFloat(constantImaginary);
    renderJulia();
});

const cancelChanges = document.getElementById("cancelChanges");

cancelChanges.addEventListener("click", (event) => {
    document.getElementById("iterations").value = maxIteration;
    document.getElementById("cR").value = constant[0];
    document.getElementById("cI").value = constant[1];
    document.getElementById("variableC").checked = variableC;
});

let intervalId;
let step = 0.1;
let directionR = 1;
let directionI = 1;

function startConstantVariation() {
  if (variableC) {
    intervalId = setInterval(() => {
      constant[0] += step * directionR;
      constant[1] += step * directionI;

      document.getElementById("cR").value = Math.trunc(constant[0] * 10) / 10;
      document.getElementById("cI").value = Math.trunc(constant[1] * 10) / 10;

      if (constant[0] >= 1.0 || constant[0] <= -1.0) {
        directionR *= -1;
      }
      if (constant[1] >= 1.0 || constant[1] <= -1.0) {
        directionI *= -1;
      }
      
      renderJulia();
    }, 500);
  }
}

function stopConstantVariation() {
  if(!variableC){
    clearInterval(intervalId);
    intervalId = null;
  }
}

renderJulia();
