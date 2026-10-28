import { isIP } from "node:net";
import { isPrivateAddress, privateTargetsAllowed, webhookUrlProblem } from "@/lib/webhook-url";
import { WEBHOOK_TIMEOUT_MS, type WebhookAttemptResult } from "@/lib/webhook-shared";

type DohAnswer = { type: number; data: string };

/**
 * Resolves A and AAAA records over DNS-over-HTTPS. Workers have no dns module,
 * and this lets us refuse hostnames that point at private addresses.
 */
async function resolveAddresses(hostname: string): Promise<string[]> {
  const lookups = [1, 28].map(async (type) => {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) throw new Error("DNS lookup failed");
    const payload = (await response.json()) as { Answer?: DohAnswer[] };
    return (payload.Answer ?? []).filter((answer) => answer.type === type).map((answer) => answer.data);
  });
  return (await Promise.all(lookups)).flat();
}

/**
 * One POST attempt from a Worker. Redirects are never followed and only a 2xx
 * counts as delivered. Workers can't reach private networks, and we also refuse
 * hostnames whose DNS answers are private before sending anything.
 */
export async function postWebhook(url: string, body: string, headers: Record<string, string>): Promise<WebhookAttemptResult> {
  const problem = webhookUrlProblem(url);
  if (problem) return { ok: false, statusCode: null, error: problem };
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    if (!privateTargetsAllowed() && !isIP(host)) {
      const addresses = await resolveAddresses(host);
      if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        return { ok: false, statusCode: null, error: `Refusing to deliver to a non-public address for ${host}` };
      }
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    await response.body?.cancel();
    const ok = response.status >= 200 && response.status < 300;
    return { ok, statusCode: response.status, error: ok ? null : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, statusCode: null, error: (error instanceof Error ? error.message : "Request failed").slice(0, 300) };
  }
}
