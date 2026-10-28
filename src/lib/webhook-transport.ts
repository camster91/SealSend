import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import https from "node:https";
import http from "node:http";
import type { LookupFunction } from "node:net";
import { isPrivateAddress, privateTargetsAllowed, webhookUrlProblem } from "@/lib/webhook-url";
import { WEBHOOK_TIMEOUT_MS, type WebhookAttemptResult } from "@/lib/webhook-shared";

/** DNS lookup that refuses private addresses, so a public hostname can't be re-pointed at internal services. */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    const allowed = privateTargetsAllowed() ? list : list.filter((entry) => !isPrivateAddress(entry.address));
    if (allowed.length === 0) {
      const blocked = Object.assign(new Error(`Refusing to deliver to a non-public address for ${hostname}`), { code: "EBLOCKED" });
      return callback(blocked, "", 0);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (err: null, addresses: LookupAddress[]) => void)(null, allowed);
    return callback(null, allowed[0].address, allowed[0].family);
  });
};

/** One POST attempt. No redirects are followed; only a 2xx counts as delivered. */
export function postWebhook(url: string, body: string, headers: Record<string, string>): Promise<WebhookAttemptResult> {
  return new Promise((resolve) => {
    const problem = webhookUrlProblem(url);
    if (problem) return resolve({ ok: false, statusCode: null, error: problem });
    const target = new URL(url);
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, {
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
      lookup: publicOnlyLookup,
      timeout: WEBHOOK_TIMEOUT_MS,
    }, (response) => {
      response.resume();
      const statusCode = response.statusCode ?? 0;
      const ok = statusCode >= 200 && statusCode < 300;
      resolve({ ok, statusCode, error: ok ? null : `HTTP ${statusCode}` });
    });
    request.on("timeout", () => request.destroy(new Error("Timed out")));
    request.on("error", (error) => resolve({ ok: false, statusCode: null, error: error.message.slice(0, 300) }));
    request.end(body);
  });
}

