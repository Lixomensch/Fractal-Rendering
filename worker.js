let constant = [-0.8, 0.156];

function computeNext(current) {
    const zx = current[0] * current[0] - current[1] * current[1];
    const zy = 2.0 * current[0] * current[1];

    current[0] = zx + constant[0];
    current[1] = zy + constant[1];
}

function iterations(z0, maxIteration) {
    let i = 0;

    while (i < maxIteration && (z0[0] * z0[0] + z0[1] * z0[1]) <= 4.0) {
        computeNext(z0);
        i++;
    }

    const mod = Math.sqrt(z0[0] * z0[0] + z0[1] * z0[1]);
    const smooth = Math.log(Math.max(1, Math.log(mod)));

    return i - smooth;
}

self.onmessage = function(event) {
    const { startX, endX, width, height, zoom, offsetX, offsetY, maxIteration } = event.data;
    const result = [];

    for (let x = startX; x < endX; x++) {
        for (let y = 0; y < height; y++) {
            let zx = (x / width) * 4.0 / zoom - 2.0 / zoom + offsetX;
            let zy = (y / height) * 4.0 / zoom - 2.0 / zoom + offsetY;
            let z0 = [zx, zy];
            let i = iterations(z0, maxIteration);
            result.push({ x, y, i });
        }
    }

    self.postMessage({ result, startX, endX });
};
