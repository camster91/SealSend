// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "https://cdn.nodemailer.com/packages/nodemailer/live.nodemailer.js";

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Enable CORS
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
    // Get Titan SMTP credentials from environment
    const smtpHost = Deno.env.get("TITAN_SMTP_HOST") || "smtp.titan.email";
    const smtpPort = parseInt(Deno.env.get("TITAN_SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("TITAN_SMTP_USER") || "contact@sealsend.app";
    const smtpPass = Deno.env.get("TITAN_SMTP_PASSWORD");
    const defaultFrom = Deno.env.get("TITAN_DEFAULT_FROM") || "Seal & Send <contact@sealsend.app>";

    if (!smtpPass) {
      throw new Error("TITAN_SMTP_PASSWORD not configured");
    }

    const body: EmailRequest = await req.json();

    if (!body.to || !body.subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing to or subject" }),
        { status: 400, headers }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true, // SSL/TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: body.from || defaultFrom,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      replyTo: body.replyTo,
    });

    console.log("Email sent:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Email error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers }
    );
  }
});

console.log("Email function ready");