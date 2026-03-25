# Fractal Rendering

This project implements Julia set fractal rendering using HTML5, JavaScript modules, and Web Workers. It generates fractal images on a `<canvas>` element with high-performance pixel processing.

## Features

- Real-time Julia set rendering with a single `putImageData` commit per frame.
- Worker-based fractal computation with transfer of typed pixel buffers.
- Palette lookup-table color mapping for smooth gradients and lower main-thread cost.
- Debounced resize handling to avoid redundant renders.
- Adaptive quality mode with hysteresis control in the UI.
- Reset button that stops simulation and returns to the initial stage.

## Technologies Used

- **HTML5**: For the basic page structure and `<canvas>` element.
- **JavaScript (ES Modules)**: For rendering pipeline, state management, and interaction logic.
- **Web Workers**: For parallel fractal iteration and pixel generation.
- **Typed Arrays / ImageData**: For efficient per-pixel operations.

## Setup

### Requirements

- A modern browser with support for HTML5 and Web Workers.
- Python 3 (optional, for local server script).

### Running the Project

1. Clone this repository:

    ```bash
    git clone https://github.com/Lixomensch/Fractal-Rendering.git
    ```

2. Navigate to the project directory:

    ```bash
    cd fractal-rendering
    ```

3. Start a local server:

    ```bash
    python3 serve.py
    ```

4. Open in browser:

    ```
    http://127.0.0.1:8080
    ```

You can also choose a custom port:

    ```bash
    python3 serve.py --port 3000
    ```

## Usage

- **Zoom**: Use the mouse wheel to zoom in or out on the fractal.
- **Pan**: Click and drag to move the view of the fractal.
- **Apply**: Applies current control values.
- **Reset**: Stops C animation and returns parameters/view to the initial stage.

## Adaptive Iterations

- **Adaptive quality** is exposed in the UI and is **unchecked by default**.
- Use the **Hysteresis** slider to control stability of quality-band transitions.
- Higher hysteresis values reduce quality oscillation while zooming; lower values react faster.


## License

This project is licensed under the [MIT License](LICENSE).


Feel free to explore and contribute to the project. We appreciate your interest and contributions!

