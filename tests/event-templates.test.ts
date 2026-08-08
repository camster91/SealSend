import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_TEMPLATES, getEventTemplate } from "../src/lib/event-templates";

function luminance(hex: string) {
  const values = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function contrast(a: string, b: string) { const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (bright + 0.05) / (dark + 0.05); }

test("launch catalog has 12 to 20 unique, editable templates", () => {
  assert.ok(EVENT_TEMPLATES.length >= 12 && EVENT_TEMPLATES.length <= 20);
  assert.equal(new Set(EVENT_TEMPLATES.map((template) => template.id)).size, EVENT_TEMPLATES.length);
  for (const template of EVENT_TEMPLATES) {
    assert.equal(getEventTemplate(template.id)?.name, template.name);
    assert.match(template.customization.primaryColor, /^#[0-9A-F]{6}$/i);
    assert.match(template.customization.backgroundColor, /^#[0-9A-F]{6}$/i);
    assert.ok(contrast(template.customization.primaryColor, template.customization.backgroundColor) >= 4.5, `${template.id} primary/background contrast`);
  }
});
