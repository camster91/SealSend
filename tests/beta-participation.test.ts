import assert from "node:assert/strict";
import test from "node:test";

import {
  BETA_CONSENT_VERSION,
  BETA_SEGMENTS,
  deriveBetaProgress,
  isBetaParticipationActive,
  parseBetaEnrollment,
} from "../src/lib/beta-participation";

test("beta enrollment requires explicit current-version consent and a supported segment", () => {
  assert.deepEqual(BETA_SEGMENTS, [
    "club_association",
    "volunteer_nonprofit",
    "creative_community",
    "alumni_professional",
    "repeat_planner",
  ]);
  assert.deepEqual(
    parseBetaEnrollment({ segment: "club_association", consent: true }),
    { segment: "club_association", consentVersion: BETA_CONSENT_VERSION },
  );
  assert.throws(() => parseBetaEnrollment({ segment: "club_association", consent: false }));
  assert.throws(() => parseBetaEnrollment({ segment: "consumer_party", consent: true }));
  assert.throws(() => parseBetaEnrollment({ segment: "wedding", consent: true }));
  assert.throws(() => parseBetaEnrollment({ segment: "wedding", consent: true, email: "not-allowed@example.com" }));
});

test("withdrawn participation is excluded from active beta evidence", () => {
  assert.equal(isBetaParticipationActive({ consentedAt: "2026-08-27T12:00:00.000Z", withdrawnAt: null }), true);
  assert.equal(isBetaParticipationActive({ consentedAt: "2026-08-27T12:00:00.000Z", withdrawnAt: "2026-08-27T13:00:00.000Z" }), false);
});

test("beta progress counts only privacy-limited milestones recorded after consent", () => {
  const progress = deriveBetaProgress({
    consentedAt: "2026-08-27T12:00:00.000Z",
    activationEvents: [
      { name: "event_published", createdAt: "2026-08-27T11:59:59.000Z" },
      { name: "event_published", createdAt: "2026-08-27T12:00:01.000Z" },
      { name: "guest_import_completed", createdAt: "2026-08-27T12:05:00.000Z" },
      { name: "first_invitation_sent", createdAt: "2026-08-27T12:10:00.000Z" },
      { name: "first_rsvp_received", createdAt: "2026-08-27T12:20:00.000Z" },
      { name: "announcement_approved", createdAt: "2026-08-27T12:25:00.000Z" },
      { name: "calendar_exported", createdAt: "2026-08-27T12:30:00.000Z" },
      { name: "first_guest_checked_in", createdAt: "2026-08-27T12:35:00.000Z" },
      { name: "account_exported", createdAt: "2026-08-27T12:40:00.000Z" },
      { name: "event_repeated", createdAt: "2026-08-27T12:45:00.000Z" },
    ],
    feedbackCount: 1,
  });

  assert.deepEqual(progress.steps, {
    account: true,
    eventAndDesign: true,
    guestImport: true,
    controlledInvite: true,
    rsvp: true,
    announcementReview: true,
    calendar: true,
    checkIn: true,
    export: true,
    feedback: true,
    repeatEvent: true,
  });
  assert.equal(progress.completedRequired, 10);
  assert.equal(progress.requiredTotal, 10);
  assert.equal(progress.allRequiredComplete, true);
});

test("beta progress remains incomplete without real milestone evidence", () => {
  const progress = deriveBetaProgress({
    consentedAt: "2026-08-27T12:00:00.000Z",
    activationEvents: [],
    feedbackCount: 0,
  });

  assert.equal(progress.steps.account, true);
  assert.equal(progress.steps.eventAndDesign, false);
  assert.equal(progress.steps.repeatEvent, false);
  assert.equal(progress.completedRequired, 1);
  assert.equal(progress.allRequiredComplete, false);
});
