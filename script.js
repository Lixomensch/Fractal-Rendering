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

    mod(){
        return this.x*this.x + this.y*this.y;
    }
}

const maxIteration = 50;
let constant = new Vector2(-0.8, 0.156);
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function computeNext(current) {
    let zr = current.x * current.x - current.y * current.y;
    let zi = 2.0 * current.x * current.y;

    return new Vector2(zr, zi).add(constant);
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

function renderJulia() {
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            let zx = (x / canvas.width) * 4.0 - 2.0;
            let zy = (y / canvas.height) * 4.0 - 2.0;
            let z0 = new Vector2(zx, zy);
            let i = iterations(z0);
            let color = `rgb(${i * 5}, ${i * 5}, ${i * 5})`;
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

renderJulia();