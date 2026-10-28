export const WEBHOOK_TIMEOUT_MS = 10_000;

export type WebhookAttemptResult = { ok: boolean; statusCode: number | null; error: string | null };
