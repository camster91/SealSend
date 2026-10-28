import assert from "node:assert/strict";
import test from "node:test";
import { createTwilioClient } from "../src/lib/twilio";
import { sendEmail } from "../src/lib/mailgun";

type Call = { url: string; init: RequestInit };
function fakeFetch(status: number, payload: unknown, calls: Call[]) {
  return async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  };
}

test("Twilio client posts a form-encoded message with basic auth and maps the response", async () => {
  const calls: Call[] = [];
  const client = createTwilioClient(
    { accountSid: "ACtest", username: "SKtest", password: "secret" },
    fakeFetch(201, { sid: "SM123", status: "queued", num_segments: "2" }, calls),
  );
  const message = await client.messages.create({ to: "+14165550100", body: "Hi", messagingServiceSid: "MGtest", statusCallback: "https://example.com/cb" });

  assert.deepEqual(message, { sid: "SM123", status: "queued", numSegments: 2 });
  assert.equal(calls[0].url, "https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Basic ${btoa("SKtest:secret")}`);
  const form = calls[0].init.body as URLSearchParams;
  assert.equal(form.get("To"), "+14165550100");
  assert.equal(form.get("Body"), "Hi");
  assert.equal(form.get("MessagingServiceSid"), "MGtest");
  assert.equal(form.get("StatusCallback"), "https://example.com/cb");
  assert.equal(form.has("From"), false);
});

test("Twilio client throws the provider message and status on failure", async () => {
  const client = createTwilioClient(
    { accountSid: "ACtest", username: "ACtest", password: "token" },
    fakeFetch(400, { message: "The 'To' number is not a valid phone number.", code: 21211 }, []),
  );
  await assert.rejects(
    client.messages.create({ to: "bad", body: "Hi", from: "+15005550006" }),
    (error: Error & { status?: number; code?: number }) => error.status === 400 && error.code === 21211 && /valid phone number/.test(error.message),
  );
});

test("Mailgun sends multipart form fields, custom headers and attachments", async () => {
  process.env.MAILGUN_API_KEY = "key-test";
  process.env.MAILGUN_DOMAIN = "mg.example.com";
  const calls: Call[] = [];
  const result = await sendEmail(
    {
      from: "SealSend <hello@mg.example.com>",
      to: ["a@example.com", "b@example.com"],
      subject: "Invitation",
      html: "<p>Hi</p>",
      replyTo: "host@example.com",
      headers: { "List-Unsubscribe": "<https://example.com/u>" },
      attachments: [{ filename: "invite.ics", data: "BEGIN:VCALENDAR", contentType: "text/calendar" }],
    },
    fakeFetch(200, { id: "<id@mg.example.com>", message: "Queued. Thank you." }, calls),
  );

  assert.deepEqual(result, { id: "<id@mg.example.com>", message: "Queued. Thank you." });
  assert.equal(calls[0].url, "https://api.mailgun.net/v3/mg.example.com/messages");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Basic ${btoa("api:key-test")}`);
  const form = calls[0].init.body as FormData;
  assert.deepEqual(form.getAll("to"), ["a@example.com", "b@example.com"]);
  assert.equal(form.get("h:Reply-To"), "host@example.com");
  assert.equal(form.get("h:List-Unsubscribe"), "<https://example.com/u>");
  const attachment = form.get("attachment") as File;
  assert.equal(attachment.name, "invite.ics");
  assert.equal(await attachment.text(), "BEGIN:VCALENDAR");
});

test("Mailgun refuses header injection and surfaces API errors", async () => {
  process.env.MAILGUN_API_KEY = "key-test";
  process.env.MAILGUN_DOMAIN = "mg.example.com";
  const base = { from: "a@example.com", to: "b@example.com", subject: "s", html: "h" };
  await assert.rejects(sendEmail({ ...base, headers: { "X-Test": "ok\r\nBcc: evil@example.com" } }, fakeFetch(200, {}, [])), /Invalid email header/);
  await assert.rejects(sendEmail({ ...base, headers: { "Bad Name": "x" } }, fakeFetch(200, {}, [])), /Invalid email header/);
  await assert.rejects(sendEmail(base, fakeFetch(401, { message: "Forbidden" }, [])), (error: Error & { status?: number }) => error.status === 401 && error.message === "Forbidden");
});
