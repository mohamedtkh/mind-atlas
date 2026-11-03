// Copies the web app into www/ for the Android build (Capacitor) and for static hosting.
// Leaves out the depth model, tests, scripts and node_modules.
import { cpSync, rmSync, mkdirSync } from "node:fs";
const out = "www";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const item of ["index.html", "manifest.webmanifest", "css", "js", "data", "vendor", "assets"]) {
  cpSync(item, `${out}/${item}`, { recursive: true });
}
console.log("www/ is ready");
