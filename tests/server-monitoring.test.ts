import test from "node:test";
import assert from "node:assert/strict";
import { buildSafeServerError, getAlertDeliveryTiming } from "../src/lib/monitoring/server-errors";

test("server monitoring stores only sanitized routing metadata", () => {
  const safe = buildSafeServerError(new TypeError("guest@example.com secret message"), { route: "/guest/update/abcdefghijklmnopqrstuvwx", method: "post", routerKind: "App Router", routeType: "route" });
  assert.equal(safe.errorName, "TypeError");
  assert.equal(safe.method, "POST");
  assert.match(safe.route, /\[token\]/);
  assert.equal(JSON.stringify(safe).includes("guest@example.com"), false);
  assert.equal(JSON.stringify(safe).includes("secret message"), false);
});

test("monitoring alert timing is bounded and retries sooner than a successful-alert cooldown", () => {
  assert.deepEqual(getAlertDeliveryTiming({ ALERT_DELIVERY_COOLDOWN_SECONDS: "999999", ALERT_DELIVERY_RETRY_SECONDS: "1" }), {
    cooldownSeconds: 86_400,
    retrySeconds: 10,
  });
  assert.deepEqual(getAlertDeliveryTiming({ ALERT_DELIVERY_COOLDOWN_SECONDS: "120", ALERT_DELIVERY_RETRY_SECONDS: "600" }), {
    cooldownSeconds: 120,
    retrySeconds: 120,
  });
});
