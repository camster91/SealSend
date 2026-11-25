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

const PLATFORM_TWIN_MAP = new Map(
  PLATFORM_MODULES.map((name) => [
    path.resolve(import.meta.dirname, `src/${name}.ts`),
    path.resolve(import.meta.dirname, `src/${name}.cloudflare.ts`),
  ]),
);

export default defineConfig({
  plugins: [
    // Catch both `@/lib/...` and relative `./...` imports of platform modules.
    {
      name: "sealsend-cloudflare-twins",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer || !source.startsWith(".")) return null;
        const candidate = path.resolve(path.dirname(importer), source);
        const withExt = candidate.endsWith(".ts") ? candidate : `${candidate}.ts`;
        return PLATFORM_TWIN_MAP.get(withExt) ?? null;
      },
    },
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
