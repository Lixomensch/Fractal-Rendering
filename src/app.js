import { FractalRenderer } from "./renderer.js";

const ENABLE_ADAPTIVE_ITERATIONS = false;
const ADAPTIVE_HYSTERESIS_RATIO = 0.14;

function debounce(fn, wait) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

class InputController {
  constructor(canvas, state, { onRenderRequest, onResize }) {
    this.canvas = canvas;
    this.state = state;
    this.onRenderRequest = onRenderRequest;
    this.onResize = onResize;

    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.handleWheel = (event) => {
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
      this.state.zoomAt(event.offsetX, event.offsetY, zoomFactor);
      this.onRenderRequest();
    };

    this.handleMouseDown = (event) => {
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    };

    this.handleMouseMove = (event) => {
      if (!this.isDragging) {
        return;
      }

      const dx = event.clientX - this.lastMouseX;
      const dy = event.clientY - this.lastMouseY;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;

      this.state.panByPixels(dx, dy);
      this.onRenderRequest();
    };

    this.handleMouseUp = () => {
      this.isDragging = false;
    };

    this.handleResize = debounce(() => {
      this.onResize();
      this.onRenderRequest();
    }, 120);

    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("mouseleave", this.handleMouseUp);
    window.addEventListener("resize", this.handleResize);
  }

  destroy() {
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("mouseleave", this.handleMouseUp);
    window.removeEventListener("resize", this.handleResize);
  }
}

export class FractalApp {
  constructor() {
    this.canvas = document.getElementById("canvas");

    this.iterationsInput = document.getElementById("iterations");
    this.constantRealInput = document.getElementById("cR");
    this.constantImaginaryInput = document.getElementById("cI");
    this.variableCInput = document.getElementById("variableC");
    this.adaptiveQualityInput = document.getElementById("adaptiveQuality");
    this.adaptiveHysteresisInput = document.getElementById("adaptiveHysteresis");
    this.adaptiveHysteresisValue = document.getElementById("adaptiveHysteresisValue");
    this.applyButton = document.getElementById("applyChanges");
    this.cancelButton = document.getElementById("cancelChanges");

    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8);
    const workerScriptUrl = new URL("./worker.js", import.meta.url);

    this.renderer = new FractalRenderer(this.canvas, {
      workerScriptUrl,
      workerCount,
      adaptiveIterationsEnabled: ENABLE_ADAPTIVE_ITERATIONS,
      adaptiveHysteresisRatio: ADAPTIVE_HYSTERESIS_RATIO,
    });

    this.initialState = {
      maxIteration: this.renderer.state.maxIteration,
      zoom: this.renderer.state.zoom,
      offsetX: this.renderer.state.offsetX,
      offsetY: this.renderer.state.offsetY,
      constantRe: this.renderer.state.constant.re,
      constantIm: this.renderer.state.constant.im,
      adaptiveQuality: ENABLE_ADAPTIVE_ITERATIONS,
      adaptiveHysteresisRatio: ADAPTIVE_HYSTERESIS_RATIO,
    };

    this.constantAnimationId = null;
    this.constantStep = 0.01;
    this.constantDirectionRe = 1;
    this.constantDirectionIm = 1;

    this.inputController = new InputController(this.canvas, this.renderer.state, {
      onResize: () => this.resizeToCanvas(),
      onRenderRequest: () => this.renderer.requestRender(),
    });

    this.#bindControls();
    this.syncAdaptiveControlsFromState();
    this.resizeToCanvas();
    this.syncControlsFromState();
    this.renderer.requestRender();
  }

  resizeToCanvas() {
    const width = Math.max(1, Math.floor(this.canvas.clientWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight));
    this.renderer.resize(width, height);
  }

  #bindControls() {
    this.adaptiveQualityInput.addEventListener("change", () => {
      this.adaptiveHysteresisInput.disabled = !this.adaptiveQualityInput.checked;
    });

    this.adaptiveHysteresisInput.addEventListener("input", () => {
      const value = Number.parseFloat(this.adaptiveHysteresisInput.value);
      this.adaptiveHysteresisValue.textContent = value.toFixed(2);
    });

    this.applyButton.addEventListener("click", () => {
      const parsedIterations = Number.parseInt(this.iterationsInput.value, 10);
      if (Number.isFinite(parsedIterations) && parsedIterations > 0) {
        this.renderer.state.maxIteration = parsedIterations;
      }

      const parsedRe = Number.parseFloat(this.constantRealInput.value);
      const parsedIm = Number.parseFloat(this.constantImaginaryInput.value);
      if (Number.isFinite(parsedRe)) {
        this.renderer.state.constant.re = parsedRe;
      }
      if (Number.isFinite(parsedIm)) {
        this.renderer.state.constant.im = parsedIm;
      }

      if (this.variableCInput.checked) {
        this.startConstantVariation();
      } else {
        this.stopConstantVariation();
      }

      const adaptiveEnabled = this.adaptiveQualityInput.checked;
      const adaptiveRatio = Number.parseFloat(this.adaptiveHysteresisInput.value);
      this.renderer.setAdaptiveHysteresisRatio(adaptiveRatio);
      this.renderer.setAdaptiveIterationsEnabled(adaptiveEnabled);

      this.renderer.requestRender();
    });

    this.cancelButton.addEventListener("click", () => {
      this.resetToInitialState();
    });
  }

  resetToInitialState() {
    this.stopConstantVariation();

    this.renderer.state.maxIteration = this.initialState.maxIteration;
    this.renderer.state.zoom = this.initialState.zoom;
    this.renderer.state.offsetX = this.initialState.offsetX;
    this.renderer.state.offsetY = this.initialState.offsetY;
    this.renderer.state.constant.re = this.initialState.constantRe;
    this.renderer.state.constant.im = this.initialState.constantIm;
    this.renderer.setAdaptiveHysteresisRatio(this.initialState.adaptiveHysteresisRatio);
    this.renderer.setAdaptiveIterationsEnabled(this.initialState.adaptiveQuality);

    this.syncControlsFromState();
    this.syncAdaptiveControlsFromState();
    this.renderer.requestRender();
  }

  syncAdaptiveControlsFromState() {
    this.adaptiveQualityInput.checked = this.initialState.adaptiveQuality;
    this.adaptiveHysteresisInput.value = this.initialState.adaptiveHysteresisRatio.toFixed(2);
    this.adaptiveHysteresisValue.textContent = this.initialState.adaptiveHysteresisRatio.toFixed(2);
    this.adaptiveHysteresisInput.disabled = !this.adaptiveQualityInput.checked;
  }

  syncControlsFromState() {
    this.iterationsInput.value = String(this.renderer.state.maxIteration);
    this.constantRealInput.value = String(this.renderer.state.constant.re);
    this.constantImaginaryInput.value = String(this.renderer.state.constant.im);
    this.variableCInput.checked = this.constantAnimationId !== null;
  }

  startConstantVariation() {
    this.stopConstantVariation();

    this.constantAnimationId = window.setInterval(() => {
      const constant = this.renderer.state.constant;

      constant.re += this.constantStep * this.constantDirectionRe;
      constant.im += this.constantStep * this.constantDirectionIm;

      if (constant.re >= 1 || constant.re <= -1) {
        this.constantDirectionRe *= -1;
      }
      if (constant.im >= 1 || constant.im <= -1) {
        this.constantDirectionIm *= -1;
      }

      this.constantRealInput.value = constant.re.toFixed(3);
      this.constantImaginaryInput.value = constant.im.toFixed(3);
      this.renderer.requestRender();
    }, 120);
  }

  stopConstantVariation() {
    if (this.constantAnimationId !== null) {
      window.clearInterval(this.constantAnimationId);
      this.constantAnimationId = null;
    }
  }

  destroy() {
    this.stopConstantVariation();
    this.inputController.destroy();
    this.renderer.destroy();
  }
}
