// supabase/functions/email-webhook/index.ts
// Triggered by database webhooks to send emails via Titan

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    to_email: string;
    from_email: string;
    subject: string;
    html_content: string;
    status: string;
  };
  schema: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    // Only process pending emails
    if (payload.table !== "email_queue" || payload.record.status !== "pending") {
      return new Response("Not a pending email", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    const supabase = createClient(supabaseUrl, serviceKey);

    // Send via Titan
    const titanResponse = await sendViaTitan({
      to: payload.record.to_email,
      from: payload.record.from_email,
      subject: payload.record.subject,
      html: payload.record.html_content,
    });

    if (titanResponse.success) {
      await supabase.rpc("mark_email_sent", {
        p_id: payload.record.id,
        p_message_id: titanResponse.messageId,
      });
    } else {
      await supabase.rpc("mark_email_failed", {
        p_id: payload.record.id,
        p_error: titanResponse.error || "Unknown error",
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
});

async function sendViaTitan(email: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Use the titan-sender function internally
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/titan-sender`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(email),
      }
    );

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send",
    };
  }
}