type SafetyEnvironment = { testOnly?: string; allowed?: string };

function normalizeRecipient(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed.replace(/[\s()-]/g, "");
}

function currentEnvironment(): SafetyEnvironment {
  return {
    testOnly: process.env.COMMUNICATIONS_TEST_ONLY,
    allowed: process.env.COMMUNICATIONS_ALLOWED_RECIPIENTS,
  };
}

export function isApprovedRecipient(recipient: string, environment: SafetyEnvironment = currentEnvironment()): boolean {
  if (environment.testOnly === "false") return true;
  const allowed = new Set((environment.allowed ?? "").split(",").map(normalizeRecipient).filter(Boolean));
  return allowed.has(normalizeRecipient(recipient));
}

export function assertApprovedRecipient(recipient: string, environment: SafetyEnvironment = currentEnvironment()): void {
  if (!isApprovedRecipient(recipient, environment)) {
    throw new Error("Communication recipient is not approved for controlled testing.");
  }
}
