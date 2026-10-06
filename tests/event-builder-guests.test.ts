import test from "node:test";
import assert from "node:assert/strict";
import { describeBulkResult, guestsAddedLabel } from "../src/lib/event-builder/guests";

test("a clean add says how many were added", () => {
  const r = describeBulkResult(201, { inserted: 2, skipped: 0, errors: [] });
  assert.equal(r.added, 2);
  assert.equal(r.error, undefined);
});

test("duplicates are explained in words", () => {
  const r = describeBulkResult(201, { inserted: 1, skipped: 2, duplicates: [{ name: "A", reason: "x" }] });
  assert.match(r.notice ?? "", /2 guests were already on your list/);
  const one = describeBulkResult(200, { inserted: 0, skipped: 1 });
  assert.match(one.notice ?? "", /1 guest was already on your list/);
  assert.equal(one.added, 0);
});

test("the limit error is shown as the server's plain sentence", () => {
  const r = describeBulkResult(403, { error: "This import would exceed the event limit of 100 guests." });
  assert.equal(r.error, "This import would exceed the event limit of 100 guests.");
});

test("raw codes and unknown failures become plain words", () => {
  assert.match(describeBulkResult(500, { error: "Internal server error" }).error ?? "", /Something went wrong/);
  assert.match(describeBulkResult(400, { error: "Invalid data", details: {} }).error ?? "", /Check the names and emails/);
  assert.match(describeBulkResult(401, null).error ?? "", /Something went wrong/);
});

test("guestsAddedLabel pluralises", () => {
  assert.equal(guestsAddedLabel(1), "1 guest added");
  assert.equal(guestsAddedLabel(3), "3 guests added");
});
