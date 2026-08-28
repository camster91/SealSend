import assert from "node:assert/strict";
import test from "node:test";

import {
  deduplicateGuestImport,
  parseGuestCsv,
  type NormalizedGuestImport,
} from "../src/lib/guest-import";

test("CSV import accepts a header and quoted names without creating a fake guest", () => {
  const result = parseGuestCsv([
    "Name,Email",
    '"Ashley, Cameron",CAMERON@example.com',
    "Jordan Lee,jordan@example.com",
  ].join("\r\n"));

  assert.deepEqual(result.guests, [
    { name: "Ashley, Cameron", email: "cameron@example.com" },
    { name: "Jordan Lee", email: "jordan@example.com" },
  ]);
  assert.deepEqual(result.issues, []);
});

test("CSV import keeps valid rows and reports invalid rows instead of failing the whole import", () => {
  const result = parseGuestCsv([
    "Valid Guest,valid@example.com",
    "Broken Email,not-an-email",
    ",missing-name@example.com",
    "Name Only",
  ].join("\n"));

  assert.deepEqual(result.guests, [
    { name: "Valid Guest", email: "valid@example.com" },
    { name: "Name Only", email: "" },
  ]);
  assert.deepEqual(result.issues, [
    { row: 2, message: "Enter a valid email address or leave it blank." },
    { row: 3, message: "Guest name is required." },
  ]);
});

test("CSV import skips duplicate emails already present or repeated in the same upload", () => {
  const result = parseGuestCsv(
    [
      "Existing Person,EXISTING@example.com",
      "First New,new@example.com",
      "Second New,NEW@example.com",
    ].join("\n"),
    [{ name: "Existing", email: "existing@example.com" }],
  );

  assert.deepEqual(result.guests, [{ name: "First New", email: "new@example.com" }]);
  assert.deepEqual(result.issues, [
    { row: 1, message: "Email existing@example.com is already on the guest list." },
    { row: 3, message: "Email new@example.com is repeated in this import." },
  ]);
});

test("server import deduplicates normalized email and phone contacts within one batch", () => {
  const candidates: NormalizedGuestImport[] = [
    { name: "Email First", email: "person@example.com", phone: null, notes: null },
    { name: "Email Again", email: "PERSON@example.com", phone: null, notes: null },
    { name: "Phone First", email: null, phone: "+14165550100", notes: null },
    { name: "Phone Again", email: null, phone: "+14165550100", notes: null },
  ];

  const result = deduplicateGuestImport(candidates, []);

  assert.deepEqual(result.accepted.map((guest) => guest.name), ["Email First", "Phone First"]);
  assert.deepEqual(result.duplicates, [
    { name: "Email Again", reason: "Email PERSON@example.com is already on this guest list" },
    { name: "Phone Again", reason: "Phone +14165550100 is already on this guest list" },
  ]);
});
