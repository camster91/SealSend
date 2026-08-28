import test from "node:test";
import assert from "node:assert/strict";
import { eventUpdateSchema } from "../src/lib/validations";

test("event updates allow an event to be archived", () => {
  const result = eventUpdateSchema.safeParse({ status: "archived" });

  assert.equal(result.success, true);
});

test("event updates do not inject create-time defaults", () => {
  const result = eventUpdateSchema.parse({ status: "archived" });

  assert.deepEqual(result, { status: "archived" });
});
