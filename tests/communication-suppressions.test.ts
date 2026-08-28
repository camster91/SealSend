import assert from "node:assert/strict";
import test from "node:test";

import {
  communicationSuppressionKey,
  isCommunicationSuppressed,
  normalizeCommunicationRecipient,
} from "../src/lib/communication-suppressions";
import {
  normalizeTwilioOptOutType,
  processTwilioOptOutEvent,
} from "../src/lib/twilio-inbound-opt-out";

type QueryCall = { text: string; values: unknown[] };

function optOutClient(ownerRows: Array<{ user_id: string; source_event_id: string }> = []) {
  const calls: QueryCall[] = [];
  return {
    calls,
    client: {
      async query<T>(text: string, values: unknown[] = []) {
        calls.push({ text, values });
        if (text.includes("INSERT INTO webhook_receipts")) {
          return { rows: [{ event_id: values[0] }] as T[] };
        }
        if (text.includes("SELECT DISTINCT")) return { rows: ownerRows as T[] };
        return { rows: [] as T[] };
      },
    },
  };
}

test("email suppressions are case-insensitive and store only a hash key", () => {
  const first = communicationSuppressionKey("email", " Guest@Example.COM ");
  const second = communicationSuppressionKey("email", "guest@example.com");

  assert.equal(first, second);
  assert.match(first, /^email:[a-f0-9]{64}$/);
  assert.equal(first.includes("guest@example.com"), false);
});

test("SMS suppressions ignore presentation punctuation", () => {
  assert.equal(
    normalizeCommunicationRecipient("sms", "+1 (416) 555-0123"),
    "+14165550123",
  );
  assert.equal(
    communicationSuppressionKey("sms", "+1 (416) 555-0123"),
    communicationSuppressionKey("sms", "+14165550123"),
  );
});

test("suppression lookup stays channel-specific", () => {
  const suppressions = new Set([communicationSuppressionKey("email", "guest@example.com")]);

  assert.equal(isCommunicationSuppressed(suppressions, "email", "GUEST@example.com"), true);
  assert.equal(isCommunicationSuppressed(suppressions, "sms", "+14165550123"), false);
});

test("Twilio OptOutType accepts only STOP, START, and HELP", () => {
  assert.equal(normalizeTwilioOptOutType("stop"), "STOP");
  assert.equal(normalizeTwilioOptOutType(" START "), "START");
  assert.equal(normalizeTwilioOptOutType("HELP"), "HELP");
  assert.equal(normalizeTwilioOptOutType("UNSUBSCRIBE"), null);
  assert.equal(normalizeTwilioOptOutType(undefined), null);
});

test("Twilio STOP records a hashed SMS suppression for every matching organizer", async () => {
  const { client, calls } = optOutClient([
    { user_id: "owner-a", source_event_id: "event-a" },
    { user_id: "owner-b", source_event_id: "event-b" },
  ]);

  const result = await processTwilioOptOutEvent(client, {
    messageSid: "SM-stop",
    from: "+1 (416) 555-0123",
    optOutType: "STOP",
  });

  assert.deepEqual(result, { handled: true, duplicate: false, optOutType: "STOP", ownerCount: 2 });
  assert.equal(calls[0]?.values[0], "inbound:SM-stop:STOP");
  const ownerLookup = calls.find((call) => call.text.includes("SELECT DISTINCT"));
  assert.equal(ownerLookup?.values[0], "+14165550123");
  assert.match(ownerLookup?.text ?? "", /JOIN events/);
  const inserts = calls.filter((call) => call.text.includes("INSERT INTO communication_suppressions"));
  assert.equal(inserts.length, 2);
  assert.deepEqual(inserts.map((call) => call.values[0]), ["owner-a", "owner-b"]);
  assert.ok(inserts.every((call) => call.values[1] === "sms"));
  assert.ok(inserts.every((call) => /^[a-f0-9]{64}$/.test(String(call.values[2]))));
  assert.ok(inserts.every((call) => !call.values.includes("+14165550123")));
});

test("Twilio START removes every local suppression for the recipient hash", async () => {
  const { client, calls } = optOutClient();

  const result = await processTwilioOptOutEvent(client, {
    messageSid: "SM-start",
    from: "+14165550123",
    optOutType: "START",
  });

  assert.deepEqual(result, { handled: true, duplicate: false, optOutType: "START", ownerCount: 0 });
  const deletes = calls.filter((call) => call.text.includes("DELETE FROM communication_suppressions"));
  assert.equal(deletes.length, 1);
  assert.equal(deletes[0]?.values[0], "sms");
  assert.match(String(deletes[0]?.values[1]), /^[a-f0-9]{64}$/);
  assert.equal(calls.some((call) => call.text.includes("SELECT DISTINCT")), false);
});

test("Twilio HELP is replay-safe and does not change suppression state", async () => {
  const { client, calls } = optOutClient([
    { user_id: "owner-a", source_event_id: "event-a" },
  ]);

  const result = await processTwilioOptOutEvent(client, {
    messageSid: "SM-help",
    from: "+14165550123",
    optOutType: "HELP",
  });

  assert.deepEqual(result, { handled: true, duplicate: false, optOutType: "HELP", ownerCount: 0 });
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /INSERT INTO webhook_receipts/);
});

test("duplicate and unsupported Twilio opt-out events do not mutate suppressions", async () => {
  const duplicateCalls: QueryCall[] = [];
  const duplicateClient = {
    async query<T>(text: string, values: unknown[] = []) {
      duplicateCalls.push({ text, values });
      return { rows: [] as T[] };
    },
  };
  assert.deepEqual(
    await processTwilioOptOutEvent(duplicateClient, {
      messageSid: "SM-duplicate",
      from: "+14165550123",
      optOutType: "STOP",
    }),
    { handled: true, duplicate: true, optOutType: "STOP", ownerCount: 0 },
  );
  assert.equal(duplicateCalls.length, 1);

  const unsupported = optOutClient();
  assert.deepEqual(
    await processTwilioOptOutEvent(unsupported.client, {
      messageSid: "SM-ordinary",
      from: "+14165550123",
      optOutType: "ordinary message",
    }),
    { handled: false, duplicate: false, optOutType: null, ownerCount: 0 },
  );
  assert.equal(unsupported.calls.length, 0);
});
