import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STANDALONE_SERVER = ".next/standalone/server.js";
const STATIC_SOURCE = ".next/static";
const STATIC_DESTINATION = ".next/standalone/.next/static";
const PUBLIC_DESTINATION = ".next/standalone/public";

await mkdir(STATIC_DESTINATION, { recursive: true });
await cp(STATIC_SOURCE, STATIC_DESTINATION, { recursive: true, force: true });
await cp("public", PUBLIC_DESTINATION, { recursive: true, force: true });

process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3100";

await import(pathToFileURL(resolve(STANDALONE_SERVER)).href);
