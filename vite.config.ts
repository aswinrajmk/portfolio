import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: "worker" } })],
  environments: {
    // Multi-page site: each HTML file is its own entry. Kept on the client environment only.
    client: {
      build: {
        rolldownOptions: {
          input: {
            main: page("./index.html"),
            dashboard: page("./dashboard/index.html"),
            run: page("./dashboard/run/index.html"),
            notFound: page("./404.html"),
          },
        },
      },
    },
    worker: { build: { sourcemap: true } },
  },
});
