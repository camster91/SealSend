export function resolveStaleDraftPolicy(retentionValue?: string, warningValue?: string) {
  const configuredRetentionDays = Number(retentionValue || "90");
  const retentionDays = Number.isFinite(configuredRetentionDays)
    ? Math.max(30, Math.floor(configuredRetentionDays))
    : 90;
  const configuredWarningDays = Number(warningValue || "14");
  const warningDays = Number.isFinite(configuredWarningDays)
    ? Math.min(retentionDays - 1, Math.max(1, Math.floor(configuredWarningDays)))
    : 14;
  return { retentionDays, warningDays, warningAgeDays: retentionDays - warningDays };
}
