import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    // Vitest owns src/ unit + component tests AND the headless sidecar
    // integration tests; Playwright owns test/visual/*.spec. Node builtins
    // (net/fs/os) work under the jsdom environment since vitest runs in Node.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "sidecar/**/*.{test,spec}.ts"],
  },
});
