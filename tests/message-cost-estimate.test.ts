import test from "node:test";
import assert from "node:assert/strict";
import { countSmsSegments, estimateDeliveryCost } from "../src/lib/messages/cost-estimate";
import { buildAnnouncementSms } from "../src/lib/sms-templates";
import { createAnnouncementApprovalProof, verifyAnnouncementApprovalProof } from "../src/lib/messages/approval-proof";

const recipients = [
  { email: "one@example.com", phone: null },
  { email: null, phone: "+14165550100" },
  { email: "both@example.com", phone: "+14165550101" },
];

test("counts and prices only the selected delivery channels", () => {
  assert.deepEqual(
    estimateDeliveryCost(recipients, ["email"], { emailMicros: "1500" }),
    { emailCount: 2, smsCount: 0, smsSegmentCount: 0, costConfigured: true, estimatedCostMicros: 3000 },
  );
});

test("requires a configured rate for every selected channel", () => {
  assert.deepEqual(
    estimateDeliveryCost(recipients, ["email", "sms"], { emailMicros: "1500" }),
    { emailCount: 2, smsCount: 2, smsSegmentCount: 2, costConfigured: false, estimatedCostMicros: null },
  );
});

test("accepts an explicit zero-cost rate", () => {
  assert.deepEqual(
    estimateDeliveryCost(recipients, ["sms"], { smsMicros: "0" }),
    { emailCount: 0, smsCount: 2, smsSegmentCount: 2, costConfigured: true, estimatedCostMicros: 0 },
  );
});

test("prices SMS using billed segments instead of recipient count", () => {
  assert.deepEqual(
    estimateDeliveryCost([
      { email: null, phone: "+14165550100", smsSegments: 2 },
      { email: null, phone: "+14165550101", smsSegments: 3 },
    ], ["sms"], { smsMicros: "20000" }),
    { emailCount: 0, smsCount: 2, smsSegmentCount: 5, costConfigured: true, estimatedCostMicros: 100000 },
  );
});

test("counts GSM extension characters and concatenated SMS segments", () => {
  assert.equal(countSmsSegments("a".repeat(160)), 1);
  assert.equal(countSmsSegments("a".repeat(161)), 2);
  assert.equal(countSmsSegments("^".repeat(80)), 1);
  assert.equal(countSmsSegments("^".repeat(81)), 2);
});

test("counts Unicode SMS with its smaller segment limits", () => {
  assert.equal(countSmsSegments("😀".repeat(35)), 1);
  assert.equal(countSmsSegments("😀".repeat(36)), 2);
});

test("announcement SMS contains the approved message body", () => {
  const body = buildAnnouncementSms({
    guestName: "Alex",
    eventTitle: "Community Dinner",
    subject: "Room changed",
    message: "We are meeting upstairs in Room 204.",
    rsvpUrl: "https://sealsend.app/e/community-dinner",
  });

  assert.match(body, /Room changed/);
  assert.match(body, /meeting upstairs in Room 204/);
});

test("approval proof binds message, audience, channels, schedule, event, and user", () => {
  process.env.SESSION_SECRET = "test-session-secret-at-least-thirty-two-characters";
  const approved = {
    eventId: "event-1",
    userId: "user-1",
    subject: "Room changed",
    message: "We are upstairs.",
    audience: { rsvpStatuses: ["attending" as const], invitationStatuses: [], tagIds: [], unansweredOnly: false },
    channels: ["sms" as const],
    sendAt: null,
  };
  const proof = createAnnouncementApprovalProof(approved, 1_000);

  assert.equal(verifyAnnouncementApprovalProof(approved, proof, 2_000), true);
  assert.equal(verifyAnnouncementApprovalProof({ ...approved, message: "Different content" }, proof, 2_000), false);
  assert.equal(verifyAnnouncementApprovalProof(approved, proof, 1_000 + 10 * 60 * 1000 + 1), false);
});
