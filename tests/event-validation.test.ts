import test from "node:test";
import assert from "node:assert/strict";
import { eventCreateSchema, eventUpdateSchema } from "../src/lib/validations";

test("event updates allow an event to be archived", () => {
  const result = eventUpdateSchema.safeParse({ status: "archived" });

  assert.equal(result.success, true);
});

test("event updates do not inject create-time defaults", () => {
  const result = eventUpdateSchema.parse({ status: "archived" });

  assert.deepEqual(result, { status: "archived" });
});

test("empty media URLs (no logo, background or music) are accepted as not set", () => {
  const customization = {
    primaryColor: "#1b2a4a", backgroundColor: "#ffffff", backgroundImage: "", fontFamily: "Inter",
    buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "", imageFit: "contain", imagePosition: "center",
  };
  const created = eventCreateSchema.safeParse({ title: "Dinner", status: "draft", event_timezone: "UTC", customization });
  assert.ok(created.success, JSON.stringify(created.success ? null : created.error.flatten()));
  assert.equal(created.data.customization?.logoUrl, null);
  assert.equal(created.data.customization?.audioUrl, null);
  assert.equal(created.data.customization?.backgroundImage, null);
  assert.ok(eventUpdateSchema.safeParse({ customization }).success);
  // A real unsafe URL is still rejected.
  assert.equal(eventCreateSchema.safeParse({ title: "Dinner", customization: { ...customization, logoUrl: "javascript:alert(1)" } }).success, false);
});
