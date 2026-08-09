const target = new URL(process.env.LOAD_TARGET_URL || "http://127.0.0.1:3100");
const slug = process.env.LOAD_EVENT_SLUG;
const attempts = Number.parseInt(process.env.LOAD_RSVP_ATTEMPTS || "10", 10);
const expectedAccepted = Number.parseInt(process.env.LOAD_EXPECTED_ACCEPTED || "3", 10);

if (process.env.ALLOW_MUTATING_LOAD_TEST !== "true") throw new Error("Set ALLOW_MUTATING_LOAD_TEST=true for a disposable event");
if (!slug || !/^qa-capacity-[a-f0-9]{32}$/.test(slug)) throw new Error("LOAD_EVENT_SLUG must identify a disposable qa-capacity event");
if (target.hostname === "sealsend.app" && process.env.ALLOW_PRODUCTION_MUTATING_LOAD_TEST !== "true") {
  throw new Error("Production mutation requires ALLOW_PRODUCTION_MUTATING_LOAD_TEST=true");
}
if (!Number.isInteger(attempts) || attempts < 2 || attempts > 25) throw new Error("LOAD_RSVP_ATTEMPTS must be between 2 and 25");
if (!Number.isInteger(expectedAccepted) || expectedAccepted < 1 || expectedAccepted >= attempts) throw new Error("Invalid LOAD_EXPECTED_ACCEPTED");

const responses = await Promise.all(Array.from({ length: attempts }, async (_, index) => {
  const response = await fetch(new URL(`/api/rsvp/${slug}`, target), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: target.origin, "User-Agent": "SealSend capacity QA/1.0" },
    body: JSON.stringify({
      respondent_name: `Capacity QA ${index}`,
      respondent_email: `qa-capacity-${index}@example.invalid`,
      status: "attending",
      headcount: 1,
      response_data: {},
      plus_ones: [],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}));
const statusCounts = responses.reduce((counts, response) => {
  counts[response.status] = (counts[response.status] || 0) + 1;
  return counts;
}, {});
console.log(JSON.stringify({ target: target.origin, slug, attempts, expectedAccepted, statusCounts }, null, 2));
const unexpected = responses.filter((response) => ![200, 403, 429].includes(response.status));
if ((statusCounts[200] || 0) !== expectedAccepted || unexpected.length) process.exitCode = 1;
