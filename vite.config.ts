// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/client",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "src/client/index.html",
        dashboard: "src/client/dashboard.html", // <-- dit mist waarschijnlijk
      },
    },
  },
});
