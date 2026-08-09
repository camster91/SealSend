export const STORAGE_QUOTAS = {
  free: 250 * 1024 * 1024,
  paidEvent: 1024 * 1024 * 1024,
  proAnnual: 5 * 1024 * 1024 * 1024,
} as const;

export function storageQuotaBytes(accountPlan: string, hasPaidEvent: boolean): number {
  if (accountPlan === "pro_annual") return STORAGE_QUOTAS.proAnnual;
  if (hasPaidEvent) return STORAGE_QUOTAS.paidEvent;
  return STORAGE_QUOTAS.free;
}

export function canReserveStorage(usedBytes: number, incomingBytes: number, quotaBytes: number): boolean {
  return usedBytes >= 0 && incomingBytes > 0 && quotaBytes > 0 && usedBytes + incomingBytes <= quotaBytes;
}
