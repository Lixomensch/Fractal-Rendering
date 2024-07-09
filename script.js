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

function getColor(iter) {
    // Normaliza o número de iterações entre 0 e 1
    let t = iter / maxIteration;

    // Define cores baseadas em um gradiente de temperatura
    let r = Math.floor(255 * (t));
    let g = Math.floor(255 * (t));
    let b = Math.floor(255 * (t));

    return `rgb(${r}, ${g}, ${b})`;
}


function renderJulia() {
    for (let x = 0; x < canvas.width / tamCell; x++) {
        for (let y = 0; y < canvas.height / tamCell; y++) {
            let zx = (x / (canvas.width / tamCell)) * 4.0 / zoom - 2.0 / zoom + offsetX;
            let zy = (y / (canvas.height / tamCell)) * 4.0 / zoom - 2.0 / zoom + offsetY;
            let z0 = new Vector2(zx, zy);
            let i = iterations(z0);

            ctx.fillStyle = getColor(i);
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
