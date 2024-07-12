const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const maxIteration = 500;
let zoom = 1.3;
let offsetX = 0.0;
let offsetY = 0.0;

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
                b: Math.floor((1 - ratio) * lower.color.b + ratio * upper.color.b)
            };
        }
    }
    return { r: 255, g: 255, b: 255 };
}

function renderJulia() {
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8);
    const width = canvas.width;
    const height = canvas.height;
    const segmentWidth = Math.ceil(width / workerCount);
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    let completedWorkers = 0;

    for (let i = 0; i < workerCount; i++) {
        const worker = new Worker('worker.js');

        worker.onmessage = function(event) {
            const result = event.data;

            result.forEach(({ x, y, i }) => {
                const normalizedIter = i / maxIteration;
                const color = getColorFromPalette(normalizedIter);
                const index = (y * width + x) * 4;
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = 255;
            });

            if (++completedWorkers === workerCount) {
                ctx.putImageData(imageData, 0, 0);
            }
        };

        worker.postMessage({
            startX: i * segmentWidth,
            endX: Math.min((i + 1) * segmentWidth, width),
            width: width,
            height: height,
            zoom: zoom,
            offsetX: offsetX,
            offsetY: offsetY,
            maxIteration: maxIteration
        });
    }
}

canvas.addEventListener('wheel', (event) => {
    if (event.deltaY < 0) {
        zoom *= 1.1;
    } else {
        zoom /= 1.1;
    }
    renderJulia();
});

let isDragging = false;
let startX, startY;

canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
});

canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        let dx = (event.clientX - startX) / canvas.width * 4.0 / zoom;
        let dy = (event.clientY - startY) / canvas.height * 4.0 / zoom;
        offsetX -= dx;
        offsetY -= dy;
        startX = event.clientX;
        startY = event.clientY;
        renderJulia();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

renderJulia();
