import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/client",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "src/client/index.html"),
        chatbot: resolve(process.cwd(), "src/client/chatbot.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
