import { Resend } from "resend";

let resend: Resend | null = null;

export function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "your-resend-api-key") {
      throw new Error(
        "RESEND_API_KEY is not configured. Please set a valid Resend API key in your environment variables. Get one at https://resend.com"
      );
    }
    resend = new Resend(apiKey);
  }
  return resend;
}
