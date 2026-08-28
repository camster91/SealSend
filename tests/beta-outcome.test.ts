import assert from "node:assert/strict";
import test from "node:test";

import {
  BETA_OUTCOME_PRICE_VERSION,
  BETA_WILLINGNESS_CHOICES,
  parseBetaOutcome,
} from "../src/lib/beta-outcome";

test("beta outcome accepts bounded structured evidence and stamps the current price proposition", () => {
  assert.deepEqual(BETA_WILLINGNESS_CHOICES, ["annual_pro", "per_event", "free_only", "unsure"]);
  assert.deepEqual(
    parseBetaOutcome({ willingnessToPay: "annual_pro", repeatIntent: 5, selfReportedSupportMinutes: 0 }),
    {
      willingnessToPay: "annual_pro",
      repeatIntent: 5,
      selfReportedSupportMinutes: 0,
      priceVersion: BETA_OUTCOME_PRICE_VERSION,
    },
  );
  assert.match(BETA_OUTCOME_PRICE_VERSION, /annual-124\.99/);
  assert.match(BETA_OUTCOME_PRICE_VERSION, /event-8\.99-49\.99/);
});

test("beta outcome rejects client-stamped, ambiguous, or out-of-range evidence", () => {
  assert.throws(() => parseBetaOutcome({ willingnessToPay: "yes", repeatIntent: 5, selfReportedSupportMinutes: 10 }));
  assert.throws(() => parseBetaOutcome({ willingnessToPay: "unsure", repeatIntent: 0, selfReportedSupportMinutes: 10 }));
  assert.throws(() => parseBetaOutcome({ willingnessToPay: "unsure", repeatIntent: 3.5, selfReportedSupportMinutes: 10 }));
  assert.throws(() => parseBetaOutcome({ willingnessToPay: "unsure", repeatIntent: 3, selfReportedSupportMinutes: 601 }));
  assert.throws(() => parseBetaOutcome({ willingnessToPay: "unsure", repeatIntent: 3, selfReportedSupportMinutes: 10, priceVersion: "client-controlled" }));
});
