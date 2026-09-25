import { randomBytes } from "node:crypto";

// Server-only: kept out of src/lib/utils.ts because that module is imported by
// client components, and a Node `crypto` import there makes the bundler ship
// the crypto-browserify polyfill (including vm-browserify's eval) to every page.
export function generateInviteToken(): string {
  return randomBytes(18).toString("base64url");
}
