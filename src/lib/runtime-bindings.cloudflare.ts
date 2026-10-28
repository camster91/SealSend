import { env } from "cloudflare:workers";

export function getBinding<T = unknown>(name: string): T | undefined {
  return env[name] as T | undefined;
}
