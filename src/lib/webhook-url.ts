import { isIP } from "node:net";

export function privateTargetsAllowed(): boolean {
  // Test-only escape hatch for local receivers; never set in production.
  return process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === "true";
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (version === 6) {
    const groups = expandIPv6(address);
    if (!groups) return true;
    const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
    const embeddedIPv4 = `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
    const upperZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
    // IPv4-mapped (::ffff:a.b.c.d, in any notation), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::/96) carry an IPv4 target.
    if (upperZero && (g5 === 0xffff || g5 === 0)) return g5 === 0 && g6 === 0 && g7 <= 1 ? true : isPrivateAddress(embeddedIPv4);
    if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPrivateAddress(embeddedIPv4);
    return (g0 & 0xfe00) === 0xfc00 // unique local fc00::/7
      || (g0 & 0xffc0) === 0xfe80 // link-local fe80::/10
      || (g0 & 0xff00) === 0xff00; // multicast
  }
  return true;
}

/** Expands any valid IPv6 text form (including an embedded dotted IPv4 tail) to eight 16-bit groups. */
function expandIPv6(address: string): number[] | null {
  let text = address.toLowerCase().split("%")[0];
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    text = `${text.slice(0, -dotted[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((group) => parseInt(group, 16));
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : null;
}

/** Static URL checks before saving an endpoint. DNS is checked again at delivery time. */
export function webhookUrlProblem(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Enter a valid URL";
  }
  if (url.username || url.password) return "The URL can't include a username or password";
  if (privateTargetsAllowed()) return url.protocol === "https:" || url.protocol === "http:" ? null : "Use an https:// URL";
  if (url.protocol !== "https:") return "Use an https:// URL";
  if (url.port && url.port !== "443") return "Use the standard HTTPS port";
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "The URL must be publicly reachable";
  }
  if (isIP(host) && isPrivateAddress(host)) return "The URL must be publicly reachable";
  return null;
}
