type SafetyEnvironment = { testOnly?: string; allowed?: string };

function normalizeRecipient(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed.replace(/[\s()-]/g, "");
}

export function assertApprovedRecipient(
  recipient: string,
  environment: SafetyEnvironment = {
    testOnly: process.env.COMMUNICATIONS_TEST_ONLY,
    allowed: process.env.COMMUNICATIONS_ALLOWED_RECIPIENTS,
  },
): void {
  if (environment.testOnly === "false") return;
  const allowed = new Set((environment.allowed ?? "").split(",").map(normalizeRecipient).filter(Boolean));
  if (!allowed.has(normalizeRecipient(recipient))) {
    throw new Error("Communication recipient is not approved for controlled testing.");
  }
}
