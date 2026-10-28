// Minimal typing for the Workers runtime module, which only exists in the Cloudflare build.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
