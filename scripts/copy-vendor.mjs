// Copies the Three.js files that the browser loads into vendor/three/, so the app works
// without a network connection. Run it after `npm install`, and again if the pinned version changes.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "three");
const to = join(root, "vendor", "three");

rmSync(to, { recursive: true, force: true });
mkdirSync(join(to, "build"), { recursive: true });
mkdirSync(join(to, "examples", "jsm", "controls"), { recursive: true });

// Only the two module files the app needs. Other builds (CommonJS, WebGPU) are left out.
const keep = (src) => {
  const name = basename(src);
  return !name.endsWith(".js") || name === "three.module.js" || name === "three.core.js";
};
cpSync(join(from, "build"), join(to, "build"), { recursive: true, filter: keep });
cpSync(
  join(from, "examples", "jsm", "controls", "OrbitControls.js"),
  join(to, "examples", "jsm", "controls", "OrbitControls.js"),
);

console.log("Copied Three.js into vendor/three/");
