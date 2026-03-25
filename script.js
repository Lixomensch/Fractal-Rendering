import { FractalApp } from "./src/app.js";

const fractalApp = new FractalApp();

window.addEventListener("beforeunload", () => {
  fractalApp.destroy();
});
