import test from "node:test";
import assert from "node:assert/strict";
import { checkLink, normalizeLink, STORED_LINK_ERROR, storedLinkProblem } from "../src/lib/event-builder/field-checks";
import { emptyBuilderData, fromEvent } from "../src/lib/event-builder/mapping";
import type { Event } from "../src/types/database";

const base = emptyBuilderData("America/Toronto");

function load(over: Record<string, unknown>) {
  return fromEvent({ ...base, id: "e1", event_date: null, event_end_date: null, rsvp_deadline: null, ...over } as unknown as Event, []);
}

test("fromEvent upgrades http:// to https:// for registry, design and media links", () => {
  const d = load({
    registry_links: [{ label: "A", url: "http://shop.example.com/list?x=1" }],
    design_url: "http://img.example.com/a.png",
    customization: { backgroundImage: "http://img.example.com/bg.png", logoUrl: "HTTP://img.example.com/l.png", audioUrl: "http://a.example.com/s.mp3" },
  });
  assert.equal(d.registry_links[0].url, "https://shop.example.com/list?x=1");
  assert.equal(d.registry_links[0].label, "A");
  assert.equal(d.design_url, "https://img.example.com/a.png");
  assert.equal(d.customization.backgroundImage, "https://img.example.com/bg.png");
  assert.equal(d.customization.logoUrl, "https://img.example.com/l.png");
  assert.equal(d.customization.audioUrl, "https://a.example.com/s.mp3");
});

test("fromEvent leaves https, /uploads/ and other values alone", () => {
  const d = load({
    registry_links: [{ label: "A", url: "https://a.example.com" }, { label: "B", url: "ftp://x.example.com/http://y" }],
    design_url: "/uploads/abc.png",
    customization: { logoUrl: "https://l.example.com/l.png", audioUrl: "" },
  });
  assert.equal(d.registry_links[0].url, "https://a.example.com");
  assert.equal(d.registry_links[1].url, "ftp://x.example.com/http://y");
  assert.equal(d.design_url, "/uploads/abc.png");
  assert.equal(d.customization.logoUrl, "https://l.example.com/l.png");
  assert.equal(d.customization.audioUrl, "");
});

test("a link that cannot be upgraded is flagged by the same check the UI uses", () => {
  const d = load({
    registry_links: [{ label: "A", url: "javascript:alert(1)" }, { label: "B", url: "not a url" }],
    design_url: "ftp://x.example.com/a.png",
  });
  for (const url of [d.registry_links[0].url, d.registry_links[1].url, d.design_url]) {
    assert.notEqual(checkLink(url), undefined);
    assert.equal(storedLinkProblem(url), STORED_LINK_ERROR);
  }
  assert.equal(STORED_LINK_ERROR, "This link needs to start with https://");
  assert.equal(storedLinkProblem("https://ok.example.com"), undefined);
  assert.equal(storedLinkProblem(""), undefined);
});

test("whitespace-only links count as empty and are sent as empty", () => {
  assert.equal(checkLink("   "), undefined);
  assert.equal(normalizeLink("   "), "");
  assert.equal(normalizeLink("\t\n"), "");
  assert.equal(normalizeLink(" https://a.example.com "), " https://a.example.com ");
});
