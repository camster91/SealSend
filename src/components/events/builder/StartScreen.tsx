"use client";

import { eventFontFamily } from "@/lib/event-font";

import { useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/ui/Feedback";
import { EVENT_TEMPLATES, type EventTemplate } from "@/lib/event-templates";
import { emptyBuilderData } from "@/lib/event-builder/mapping";
import type { StartDecision } from "@/lib/event-builder/start-decision";
import { EventBuilder } from "./EventBuilder";
import { ChatBuilder } from "./chat/ChatBuilder";

interface StartScreenProps {
  decision: StartDecision;
  template?: EventTemplate;
  organization?: { id: string; name: string };
  /** Server-computed: true when the AI chat is configured. */
  aiChatEnabled?: boolean;
  aiCoverEnabled?: boolean;
}

const CARD = "flex min-h-11 w-full flex-col items-start gap-1 rounded-2xl border border-ink/15 bg-white p-5 text-left transition hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";
const BUTTON = "inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function StartScreen({ decision: initialDecision, template, organization, aiChatEnabled = false, aiCoverEnabled = false }: StartScreenProps) {
  const confirm = useConfirm();
  const [decision, setDecision] = useState<StartDecision>(initialDecision);
  const [chosen, setChosen] = useState<EventTemplate | undefined>(template);
  const [building, setBuilding] = useState<{ timezone: string; template?: EventTemplate; chat?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<'All' | EventTemplate['category']>('All');

  function begin(picked?: EventTemplate, chat = false) {
    setChosen(picked);
    setBuilding({ timezone: browserTimezone(), template: picked, chat });
  }

  async function startOver(eventId: string) {
    const ok = await confirm({
      title: "Start over?",
      description: "This deletes your draft. You can't undo it.",
      confirmLabel: "Delete draft",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setDecision({ kind: "fresh" });
    } catch {
      setMessage("We could not delete your draft. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const intro = (
    <>
      {organization && <p className="mb-2 text-sm text-ink">Creating in the <strong>{organization.name}</strong> workspace.</p>}
      {chosen && <p className="mb-6 text-sm text-ink">Starting with <strong>{chosen.name}</strong>. You can change every setting.</p>}
    </>
  );

  if (building) {
    return (
      <>
        <div className="mx-auto w-full max-w-6xl px-4 lg:px-6 empty:hidden">{intro}</div>
        {building.chat ? (
          <ChatBuilder
            initial={emptyBuilderData(building.timezone, building.template?.customization)}
            organizationId={organization?.id}
            aiCoverEnabled={aiCoverEnabled}
          />
        ) : (
        <EventBuilder
          mode="create"
          initial={emptyBuilderData(building.timezone, building.template?.customization)}
          templateCustomization={building.template?.customization}
          organizationId={organization?.id}
          aiCoverEnabled={aiCoverEnabled}
        />
        )}
      </>
    );
  }

  if (decision.kind === "continue-draft") {
    return (
      <section aria-labelledby="start-heading" className="mx-auto max-w-3xl">
        <h1 id="start-heading" className="font-display text-3xl text-ink">Continue your draft</h1>
        <p className="mt-2 text-sm text-ink">You have a draft called <strong>{decision.title}</strong>.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/events/${decision.eventId}/build`} className={`${BUTTON} bg-ink text-white`}>Continue your draft</Link>
          <button type="button" disabled={busy} onClick={() => void startOver(decision.eventId)} className={`${BUTTON} border border-ink bg-white text-ink`}>Start over</button>
        </div>
        {message && <p role="alert" className="mt-4 text-sm text-wax">{message}</p>}
      </section>
    );
  }

  if (decision.kind === "at-limit") {
    return (
      <section aria-labelledby="start-heading" className="mx-auto max-w-3xl">
        <h1 id="start-heading" className="font-display text-3xl text-ink">What are you planning?</h1>
        <p className="mt-4 text-sm text-ink">
          Free accounts can have one active event. Open{" "}
          <Link href={`/events/${decision.eventId}`} className="font-semibold underline underline-offset-2">{decision.title}</Link>{" "}
          or archive it to start another.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="start-heading" className="mx-auto max-w-3xl">
      {intro}
      <h1 id="start-heading" className="font-display text-3xl text-ink">What are you planning?</h1>
      <div className="mt-6 grid gap-4">
        {aiChatEnabled && (
          <button type="button" onClick={() => begin(chosen, true)} className={CARD}>
            <span className="text-base font-semibold text-ink">Chat with AI</span>
            <span className="text-sm text-ink/80">Tell me about your event and I&apos;ll build it.</span>
          </button>
        )}
        <button type="button" onClick={() => begin(chosen)} className={CARD}>
          <span className="text-base font-semibold text-ink">Build it yourself</span>
          <span className="text-sm text-ink/80">Answer a few questions. We save as you go.</span>
        </button>
      </div>
      <h2 className="mt-8 text-sm font-semibold text-ink">Or start from a look</h2>
      <div role="group" aria-label="Filter invitation looks" className="mt-3 flex flex-wrap gap-2">
        {(['All', 'Wedding', 'Celebration', 'Business', 'Community'] as const).map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`${BUTTON} border border-ink/20 ${category === item ? 'bg-ink text-white' : 'bg-white text-ink'}`}>{item}</button>)}
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {EVENT_TEMPLATES.filter((t) => category === 'All' || t.category === category).map((t) => (
          <li key={t.id}>
            <button type="button" aria-label={`Start with ${t.name}`} onClick={() => begin(t)} className={`${CARD} gap-3`}>
              <span aria-hidden="true" className="flex min-h-36 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-black/10 p-4 text-center" style={{ backgroundColor: t.customization.backgroundColor, color: t.customization.primaryColor, fontFamily: eventFontFamily(t.customization.fontFamily) }}>
                <span className="text-xs uppercase tracking-widest">You're invited</span>
                <span className="text-xl font-semibold">{t.name}</span>
                <span className="h-px w-10 bg-current opacity-40" />
                <span className="text-xs">Date · Time · Place</span>
                <span className="mt-1 px-5 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: t.customization.primaryColor, borderRadius: t.customization.buttonStyle === 'pill' ? '9999px' : t.customization.buttonStyle === 'square' ? '0' : '8px' }}>RSVP</span>
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {t.name}
              </span>
              <span className="text-xs text-ink/80">{t.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
