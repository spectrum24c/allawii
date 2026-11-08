import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base is set at build time for GitHub Pages project sites
export default defineConfig(({ mode }) => {
  // loadEnv reads .env files too, so a local `.env` with VITE_BASE_PATH works the same
  // as an inline `VITE_BASE_PATH=/x/ npm run build`.
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react(), tailwindcss()],
    build: { outDir: "dist", sourcemap: false },
  };
});
