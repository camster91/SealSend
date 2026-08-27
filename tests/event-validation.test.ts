import test from "node:test";
import assert from "node:assert/strict";
import { eventUpdateSchema } from "../src/lib/validations";

test("event updates allow an event to be archived", () => {
  const result = eventUpdateSchema.safeParse({ status: "archived" });

  assert.equal(result.success, true);
});
