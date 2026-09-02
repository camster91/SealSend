import assert from "node:assert/strict";
import test from "node:test";
import { getAnnualProCtaMode } from "../src/lib/pricing-cta";

test("annual Pro stays fail-closed when checkout is unavailable", () => {
  assert.equal(getAnnualProCtaMode(false, false), "contact");
  assert.equal(getAnnualProCtaMode(false, true), "contact");
});

test("annual Pro uses checkout only for authenticated users when ready", () => {
  assert.equal(getAnnualProCtaMode(true, true), "checkout");
  assert.equal(getAnnualProCtaMode(true, false), "signup");
});
