/**
 * Platform bindings (R2, Images, Hyperdrive). Docker/Node has none, so this
 * returns undefined; the Cloudflare build swaps in runtime-bindings.cloudflare.ts.
 */
export function getBinding<T = unknown>(name: string): T | undefined {
  void name;
  return undefined;
}
