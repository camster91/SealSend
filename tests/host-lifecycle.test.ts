import assert from "node:assert/strict";
import test from "node:test";

import { buildHostLifecycleMessage } from "../src/lib/host-lifecycle";

test("post-event repeat message links outcomes and the reviewed next-event workflow", () => {
  const message = buildHostLifecycleMessage({
    user_id: "user-1",
    email: "organizer@example.test",
    event_id: "event-1",
    title: "Community <Night>",
    notification_type: "post_event_repeat",
    scope_key: "post_event_repeat:event-1",
  }, "https://example.test");

  assert.match(message.text, /https:\/\/example\.test\/events\/event-1\/analytics/);
  assert.match(message.text, /Repeat event/);
  assert.match(message.html, /Review outcomes/);
  assert.match(message.html, /Community &lt;Night&gt;/);
  assert.doesNotMatch(message.html, /Community <Night>/);
});
