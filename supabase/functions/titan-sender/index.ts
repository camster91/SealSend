// supabase/functions/titan-sender/index.ts
// Edge Function to send emails via Titan SMTP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailRequest {
  queue_id?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

interface TitanConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

const getTitanConfig = (): TitanConfig => ({
  host: Deno.env.get("TITAN_SMTP_HOST") || "smtp.titan.email",
  port: parseInt(Deno.env.get("TITAN_SMTP_PORT") || "465"),
  user: Deno.env.get("TITAN_SMTP_USER") || "contact@sealsend.app",
  pass: Deno.env.get("TITAN_SMTP_PASSWORD") || "",
  from: Deno.env.get("TITAN_DEFAULT_FROM") || "Seal & Send <contact@sealsend.app>",
});

// Buffered SMTP connection handler
class SmtpConnection {
  private conn: Deno.TlsConn;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";

  constructor(conn: Deno.TlsConn) {
    this.conn = conn;
  }

  // Read until we have a complete SMTP response (final line has code + space, not code + dash)
  async readResponse(): Promise<string> {
    while (true) {
      // Check if we already have a complete response in the buffer
      const lines = this.buffer.split("\r\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // A final SMTP response line: 3-digit code followed by space (not dash)
        if (line.length >= 4 && /^\d{3} /.test(line)) {
          // Everything up to and including this line is the response
          const response = lines.slice(0, i + 1).join("\r\n");
          // Keep remaining data in buffer
          this.buffer = lines.slice(i + 1).join("\r\n");
          if (this.buffer.startsWith("\r\n")) this.buffer = this.buffer.slice(2);
          return response;
        }
      }

      // Need more data
      const chunk = new Uint8Array(4096);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("Connection closed unexpectedly");
      this.buffer += this.decoder.decode(chunk.subarray(0, n));
    }
  }

  async sendCommand(cmd: string): Promise<string> {
    if (cmd) {
      await this.conn.write(this.encoder.encode(cmd + "\r\n"));
    }
    return await this.readResponse();
  }

  async sendRaw(data: string): Promise<void> {
    await this.conn.write(this.encoder.encode(data));
  }

  close(): void {
    this.conn.close();
  }
}

function expectCode(response: string, code: string): void {
  if (!response.startsWith(code)) {
    throw new Error(`SMTP error: expected ${code}, got: ${response.split("\r\n")[0]}`);
  }
}

async function sendEmailViaTitan(
  config: TitanConfig,
  email: EmailRequest
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let smtp: SmtpConnection | null = null;
  try {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const from = email.from || config.from;
    const to = email.to;
    const subject = encodeMimeHeader(email.subject);
    const htmlContent = email.html;
    const textContent = email.text || stripHtml(email.html);

    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      textContent,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const conn = await Deno.connectTls({
      hostname: config.host,
      port: config.port,
    });
    smtp = new SmtpConnection(conn);

    // Server greeting
    const greeting = await smtp.sendCommand("");
    expectCode(greeting, "220");

    // EHLO
    const ehlo = await smtp.sendCommand(`EHLO sealsend.ai`);
    expectCode(ehlo, "250");

    // AUTH PLAIN - two-step: send AUTH PLAIN, wait for 334, then send credentials
    const authChallenge = await smtp.sendCommand("AUTH PLAIN");
    expectCode(authChallenge, "334");
    const authPlain = btoa(`\0${config.user}\0${config.pass}`);
    const authResp = await smtp.sendCommand(authPlain);
    expectCode(authResp, "235");

    // MAIL FROM
    const mailFrom = await smtp.sendCommand(`MAIL FROM:<${extractEmail(from)}>`);
    expectCode(mailFrom, "250");

    // RCPT TO
    const rcptTo = await smtp.sendCommand(`RCPT TO:<${to}>`);
    expectCode(rcptTo, "250");

    // DATA
    const dataReady = await smtp.sendCommand("DATA");
    expectCode(dataReady, "354");

    // Send message body, terminated with \r\n.\r\n
    await smtp.sendRaw(message + "\r\n.\r\n");
    const dataResp = await smtp.readResponse();
    expectCode(dataResp, "250");

    // Extract message ID
    const messageIdMatch = dataResp.match(/<([^>]+)>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : undefined;

    // QUIT
    await smtp.sendCommand("QUIT");
    smtp.close();

    return { success: true, messageId };
  } catch (error) {
    console.error("SMTP error:", error);
    try { smtp?.close(); } catch { /* ignore */ }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function encodeMimeHeader(text: string): string {
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return "=?UTF-8?B?" + btoa(unescape(encodeURIComponent(text))) + "?=";
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

serve(async (req: Request): Promise<Response> => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const config = getTitanConfig();

    if (!config.pass) {
      throw new Error("TITAN_SMTP_PASSWORD not configured");
    }

    const body: EmailRequest = await req.json();

    if (!body.to || !body.subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing to or subject" }),
        { status: 400, headers }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 400, headers }
      );
    }

    const result = await sendEmailViaTitan(config, body);

    if (result.success && body.queue_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/mark_email_sent`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_id: body.queue_id,
            p_message_id: result.messageId,
          }),
        });
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 500, headers }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers }
    );
  }
});

console.log("Titan sender function ready");
