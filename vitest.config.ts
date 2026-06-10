import { defineConfig } from "vitest/config";

export default defineConfig({
  // The lib tests are pure TS — no CSS. Override PostCSS discovery so Vite
  // doesn't try to load the Tailwind v4 plugin from postcss.config.mjs.
  // (The SQLite store uses node:sqlite and is verified via a real-Node script,
  // not vitest, whose bundler doesn't resolve that experimental builtin.)
  css: { postcss: { plugins: [] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
