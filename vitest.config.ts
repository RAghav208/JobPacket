import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // The lib tests are pure TS — no CSS. Override PostCSS discovery so Vite
  // doesn't try to load the Tailwind v4 plugin from postcss.config.mjs.
  // (The SQLite store uses node:sqlite and is verified via a real-Node script,
  // not vitest, whose bundler doesn't resolve that experimental builtin.)
  css: { postcss: { plugins: [] } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // Component tests (.test.tsx) need a DOM; pure lib tests (.test.ts) stay on node.
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
  },
});
