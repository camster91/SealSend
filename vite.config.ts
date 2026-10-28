import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

// Modules with a Workers-specific twin (`<name>.cloudflare.ts`). The Docker/Node
// build uses the originals; only this Vite build swaps them in.
const PLATFORM_MODULES = [
  "lib/blob-store",
  "lib/db/client",
  "lib/image-processor",
  "lib/runtime-bindings",
  "lib/webhook-transport",
];

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: PLATFORM_MODULES.map((name) => ({
      find: new RegExp(`^@/${name}$`),
      replacement: path.resolve(import.meta.dirname, `src/${name}.cloudflare.ts`),
    })),
  },
});
