function computeNext(current, constant) {
    const zx = current[0] * current[0] - current[1] * current[1];
    const zy = 2.0 * current[0] * current[1];

    current[0] = zx + constant[0];
    current[1] = zy + constant[1];
}

function iterations(z0, maxIteration, constant) {
    let i = 0;

    while (i < maxIteration && (z0[0] * z0[0] + z0[1] * z0[1]) <= 4.0) {
        computeNext(z0,constant);
        i++;
    }

    const mod = Math.sqrt(z0[0] * z0[0] + z0[1] * z0[1]);
    const smooth = i - Math.log(Math.max(mod, 1)) / Math.log(2);

    return smooth;
}   

self.onmessage = function(event) {
    const { startX, endX, width, height, zoom, offsetX, offsetY, maxIteration, constant } = event.data;
    const result = [];

    for (let x = startX; x < endX; x++) {
        for (let y = 0; y < height; y++) {
            let zx = (x / width) * 4.0 / zoom - 2.0 / zoom + offsetX;
            let zy = (y / height) * 4.0 / zoom - 2.0 / zoom + offsetY;
            let z0 = [zx, zy];
            let i = iterations(z0, maxIteration, constant);
            result.push({ x, y, i });
        }
    }

    self.postMessage(result);
};