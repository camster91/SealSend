"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "sending" | "done" | "error";

export function UnsubscribeForm({ token, hostName, email }: { token: string; hostName: string; email: string }) {
  const [status, setStatus] = useState<Status>("idle");

  async function stopEmails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch(`/api/unsubscribe/${encodeURIComponent(token)}`, { method: "POST" });
      setStatus(response.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div role="status">
        <h1 className="break-words text-2xl font-semibold">Done.</h1>
        <p className="mt-3 text-base">
          {hostName} won&apos;t email you through SealSend any more.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={stopEmails}>
      <h1 className="break-words text-2xl font-semibold">Stop emails from {hostName}?</h1>
      <p className="mt-3 text-base text-muted-foreground">
        We&apos;ll stop sending emails from {hostName} to <span className="break-all font-medium text-ink">{email}</span>.
        Other hosts on SealSend can still email you.
      </p>
      <Button type="submit" size="lg" className="mt-6 h-auto min-h-12 w-full whitespace-normal py-3" loading={status === "sending"}>
        Stop emails from {hostName}
      </Button>
      {status === "error" && (
        <p role="alert" className="mt-3 text-sm text-accent-red">
          That didn&apos;t work. Please try again in a minute.
        </p>
      )}
    </form>
  );
}
