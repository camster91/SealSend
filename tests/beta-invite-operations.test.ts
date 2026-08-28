import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyBetaInvite,
  parseBetaInviteLabel,
} from "../src/lib/beta-invite-operations";

test("operator beta invitation labels accept only pseudonymous host identifiers", () => {
  assert.equal(parseBetaInviteLabel("host-abcdef123456"), "host-abcdef123456");
  assert.throws(() => parseBetaInviteLabel("host-ABCDEF123456"));
  assert.throws(() => parseBetaInviteLabel("host-abcdef12345"));
  assert.throws(() => parseBetaInviteLabel("person@example.com"));
});

test("beta invitation status prioritizes accepted and revoked terminal states", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");
  assert.equal(classifyBetaInvite({ acceptedAt: "2026-08-27T11:00:00.000Z", revokedAt: null, expiresAt: "2026-08-28T12:00:00.000Z" }, now), "accepted");
  assert.equal(classifyBetaInvite({ acceptedAt: null, revokedAt: "2026-08-27T11:00:00.000Z", expiresAt: "2026-08-26T12:00:00.000Z" }, now), "revoked");
});

test("beta invitation status distinguishes available and expired invitations", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");
  assert.equal(classifyBetaInvite({ acceptedAt: null, revokedAt: null, expiresAt: "2026-08-27T12:00:01.000Z" }, now), "available");
  assert.equal(classifyBetaInvite({ acceptedAt: null, revokedAt: null, expiresAt: "2026-08-27T12:00:00.000Z" }, now), "expired");
});
