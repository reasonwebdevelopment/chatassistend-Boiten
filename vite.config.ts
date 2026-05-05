// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/client",
  publicDir: "../../public",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "src/client/index.html",
        dashboard: "src/client/chats.html",
        dashboard_2: "src/client/overzicht.html",
      },
    },
  },
});
