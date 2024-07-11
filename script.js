class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subtract(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    mod() {
        return this.x * this.x + this.y * this.y;
    }
}

const palette = [
    { value: 0.0, color: { r: 25, g: 24, b: 23 } },
    { value: 0.03, color: { r: 120, g: 90, b: 70 } },
    { value: 0.05, color: { r: 130, g: 24, b: 23 } },
    { value: 0.25, color: { r: 250, g: 179, b: 100 } },
    { value: 0.5, color: { r: 43, g: 65, b: 98 } },
    { value: 0.85, color: { r: 11, g: 110, b: 79 } },
    { value: 0.95, color: { r: 150, g: 110, b: 79 } },
    { value: 1.0, color: { r: 255, g: 255, b: 255 } }
];

const maxIteration = 500;
let constant = new Vector2(-0.8, 0.156);
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let zoom = 1.0;
let offsetX = 0.0;
let offsetY = 0.0;

function computeNext(current) {
    let xr = current.x * current.x - current.y * current.y;
    let zi = 2.0 * current.x * current.y;

    return new Vector2(xr, zi).add(constant);
}

function iterations(z0) {
    let zn = z0;
    let i = 0;
    
    while (i < maxIteration && zn.mod() <= 4.0) {
        zn = computeNext(zn);
        i++;
    }

    let mod = Math.sqrt(zn.mod());
    let smooth = Math.log(Math.max(1, Math.log(mod)));
    
    return i - smooth;
}

const tamCell = 1;

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
    for (let x = 0; x < canvas.width / tamCell; x++) {
        for (let y = 0; y < canvas.height / tamCell; y++) {
            let zx = (x / (canvas.width / tamCell)) * 4.0 / zoom - 2.0 / zoom + offsetX;
            let zy = (y / (canvas.height / tamCell)) * 4.0 / zoom - 2.0 / zoom + offsetY;
            let z0 = new Vector2(zx, zy);
            let iter = iterations(z0);
            let normalizedIter = iter / maxIteration;
            let color = getColorFromPalette(normalizedIter);

            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(x * tamCell, y * tamCell, tamCell, tamCell);
        }
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
