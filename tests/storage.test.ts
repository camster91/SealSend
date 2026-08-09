import test from "node:test";
import assert from "node:assert/strict";
import { canReserveStorage, STORAGE_QUOTAS, storageQuotaBytes } from "../src/lib/storage";

test("storage quotas grow only for paid events and annual Pro", () => {
  assert.equal(storageQuotaBytes("free", false), STORAGE_QUOTAS.free);
  assert.equal(storageQuotaBytes("free", true), STORAGE_QUOTAS.paidEvent);
  assert.equal(storageQuotaBytes("pro_annual", false), STORAGE_QUOTAS.proAnnual);
});

test("storage reservation fails closed at the quota boundary", () => {
  assert.equal(canReserveStorage(90, 10, 100), true);
  assert.equal(canReserveStorage(90, 11, 100), false);
  assert.equal(canReserveStorage(0, 0, 100), false);
});
