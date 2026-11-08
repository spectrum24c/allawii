// GitHub Pages serves static files only. Copying the built shell to 404.html lets
// deep links such as /login or /dashboard boot the SPA instead of a Pages 404.
import { copyFileSync, existsSync } from "node:fs";

if (!existsSync("dist/index.html")) {
  throw new Error("dist/index.html missing - run vite build first");
}
copyFileSync("dist/index.html", "dist/404.html");
console.log("spa fallback written: dist/404.html");
