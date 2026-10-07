"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ChatEventField } from "@/lib/ai/chat-schema";
import { applyChatUpdates } from "@/lib/event-builder/chat-apply";
import {
  browserTimezone,
  buildChatRequest,
  chatErrorFor,
  chipsForTurn,
  DST_GAP_MESSAGE,
  droppedDate,
  isChatTurn,
  localToday,
  openingState,
  READY_MESSAGE,
  REVIEW_CHIP,
  shouldApplyReply,
  shouldCreateDraft,
  type ChatError,
  type ChatMessage,
} from "@/lib/event-builder/chat-client";
import type { BuilderData } from "@/lib/event-builder/schema";
import { EventBuilder } from "../EventBuilder";
import { InvitePreview } from "../InvitePreview";
import { SaveIndicator } from "../SaveIndicator";
import { useEventDraft } from "../useEventDraft";
import { ChatChips } from "./ChatChips";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages, type ChatLogMessage } from "./ChatMessages";

export interface ChatBuilderProps {
  eventId?: string;
  initial: BuilderData;
  organizationId?: string;
  /** Reopening the chat on an existing draft: there is no transcript, so it greets the host again. */
  resumed?: boolean;
}

const chatPath = (id: string) => `/events/${id}/chat`;

export function ChatBuilder({ eventId: initialEventId, initial, organizationId, resumed = false }: ChatBuilderProps) {
  const router = useRouter();
  const draft = useEventDraft({ eventId: initialEventId, initial, organizationId, draftPath: chatPath });
  const [opening] = useState(() => openingState(resumed));
  const nextId = useRef(1);
  const [messages, setMessages] = useState<ChatLogMessage[]>(() => [{ id: 0, role: "assistant", text: opening.text }]);
  const [chips, setChips] = useState<string[]>(opening.chips);
  const [waiting, setWaiting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [manual, setManual] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Fields the AI filled and the host hasn't touched since (ruling R2: memory only, never stored).
  const aiOwned = useRef<Set<ChatEventField>>(new Set());
  const wasReady = useRef(false);
  // The conversation as last sent, so Retry can send it again unchanged.
  const lastSent = useRef<ChatMessage[]>([]);
  // Bumped when the host leaves the chat, so a reply still in flight is ignored instead of creating or saving anything.
  const session = useRef(0);

  const append = (role: ChatMessage["role"], text: string) => {
    const message = { id: nextId.current++, role, text };
    setMessages((prev) => [...prev, message]);
  };

  async function request(conversation: ChatMessage[]) {
    lastSent.current = conversation;
    const sentIn = session.current;
    setWaiting(true);
    setError(null);
    try {
      const body = buildChatRequest({
        eventId: draft.eventId,
        messages: conversation,
        data: draft.data,
        today: localToday(),
        timezone: browserTimezone(),
      });
      let response: Response;
      try {
        response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        if (shouldApplyReply(sentIn, session.current)) setError(chatErrorFor(0, null));
        return;
      }
      const json: unknown = await response.json().catch(() => null);
      if (!shouldApplyReply(sentIn, session.current)) return;
      if (!response.ok || !isChatTurn(json)) {
        setError(chatErrorFor(response.ok ? 502 : response.status, json));
        return;
      }

      const latestUserText = [...conversation].reverse().find((m) => m.role === "user")?.text ?? "";
      const { patch, aiOwned: owned, dropped } = applyChatUpdates(draft.data, json, {
        aiOwned: aiOwned.current,
        latestUserText,
      });
      aiOwned.current = owned;
      if (Object.keys(patch).length > 0) draft.update(patch);
      // The first name creates the draft; until then edits live only in the hook's state.
      if (shouldCreateDraft(draft.eventId, { title: patch.title ?? draft.data.title })) {
        // A failure shows in the save indicator; the chat carries on and retries on the next turn.
        draft.ensureDraft().catch(() => undefined);
      }

      append("assistant", json.reply);
      // Kept in the transcript so the assistant hears about it on the next turn.
      if (droppedDate(dropped)) append("assistant", DST_GAP_MESSAGE);
      if (json.ready && !wasReady.current && json.reply.trim() !== READY_MESSAGE) append("assistant", READY_MESSAGE);
      wasReady.current = json.ready;
      setChips(chipsForTurn(json));
    } finally {
      setWaiting(false);
    }
  }

  function send(text: string) {
    if (waiting || leaving) return;
    const conversation: ChatMessage[] = [...messages.map(({ role, text: t }) => ({ role, text: t })), { role: "user", text }];
    append("user", text);
    setChips([]);
    void request(conversation);
  }

  /**
   * The draft id, creating the draft if there's a name for it. "none" means there's no name yet;
   * "failed" means creating it failed (the save indicator shows why and offers Try again).
   */
  async function draftId(): Promise<string | "none" | "failed"> {
    if (draft.eventId) return draft.eventId;
    if (!shouldCreateDraft(undefined, draft.data)) return "none";
    return draft.ensureDraft().catch(() => "failed" as const);
  }

  /** Stops applying any reply still in flight: the host is moving on. */
  function leave() {
    session.current += 1;
    setLeaving(true);
  }

  /** Saves everything, then opens the builder. Stays put when the save failed (the save indicator offers Try again). */
  async function leaveTo(path: string) {
    const settled = await draft.flush();
    if (settled.kind === "failed") {
      setLeaving(false);
      return;
    }
    router.push(path);
  }

  async function reviewAndPublish() {
    leave();
    const id = await draftId();
    if (id === "none" || id === "failed") {
      setLeaving(false);
      return;
    }
    await leaveTo(`/events/${id}/build?step=review`);
  }

  async function switchToManual() {
    leave();
    const id = await draftId();
    if (id === "none") {
      // No name yet, so no draft: carry on in the manual builder right here, with everything filled in so far.
      setManual(true);
      return;
    }
    if (id === "failed") {
      // Stay: switching in place would leave this draft's save problem behind unseen.
      setLeaving(false);
      return;
    }
    await leaveTo(`/events/${id}/build`);
  }

  function pick(chip: string) {
    if (chip === REVIEW_CHIP && wasReady.current) void reviewAndPublish();
    else send(chip);
  }

  if (manual) {
    return <EventBuilder mode="create" initial={draft.data} organizationId={organizationId} />;
  }

  const blocked = error?.blocked ?? false;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-4 pt-6 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Tell me about your event</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator status={draft.status} onRetry={draft.retry} />
          <Button type="button" variant="outline" size="lg" disabled={leaving} onClick={switchToManual}>
            Switch to manual
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Chat" className="flex min-w-0 flex-col gap-4">
          <ChatMessages messages={messages} />

          {error && (
            <div role="alert" className="rounded-2xl border border-wax/30 bg-white p-4 text-ink">
              <p className="text-base">{error.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {error.retry && (
                  <Button type="button" size="lg" disabled={waiting} onClick={() => void request(lastSent.current)}>
                    Retry
                  </Button>
                )}
                <Button type="button" variant="outline" size="lg" disabled={leaving} onClick={switchToManual}>
                  Switch to manual
                </Button>
              </div>
            </div>
          )}

          <ChatChips chips={chips} disabled={waiting || leaving || blocked} onPick={pick} />

          <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-cotton px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
            <ChatComposer waiting={waiting} disabled={blocked || leaving} onSend={send} />
            <Button type="button" variant="outline" size="lg" className="mt-3 w-full lg:hidden" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Preview
            </Button>
          </div>
        </section>

        <aside aria-label="Invite preview" className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
            <InvitePreview data={draft.data} />
          </div>
        </aside>
      </div>

      <Modal sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview" className="lg:hidden">
        <InvitePreview data={draft.data} />
      </Modal>
    </div>
  );
}
