import test from "node:test";
import assert from "node:assert/strict";
import { buildSafeServerError } from "../src/lib/monitoring/server-errors";

test("server monitoring stores only sanitized routing metadata", () => {
  const safe = buildSafeServerError(new TypeError("guest@example.com secret message"), { route: "/guest/update/abcdefghijklmnopqrstuvwx", method: "post", routerKind: "App Router", routeType: "route" });
  assert.equal(safe.errorName, "TypeError");
  assert.equal(safe.method, "POST");
  assert.match(safe.route, /\[token\]/);
  assert.equal(JSON.stringify(safe).includes("guest@example.com"), false);
  assert.equal(JSON.stringify(safe).includes("secret message"), false);
});
