import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Ladle adds its own React plugin; here we only need the `@` alias so the
// shadcn components' internal `@/lib/utils` imports resolve.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
});
