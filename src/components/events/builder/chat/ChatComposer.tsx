"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CHAT_MAX_MESSAGE_CHARS } from "@/lib/ai/chat-schema";

interface ChatComposerProps {
  /** True while the assistant is answering: shows the typing dots and holds the Send button. */
  waiting: boolean;
  /** True when sending can't help (for example, today's AI help is used up). */
  disabled?: boolean;
  onSend: (text: string) => void;
}

export function ChatComposer({ waiting, disabled = false, onSend }: ChatComposerProps) {
  const id = useId();
  const [text, setText] = useState("");
  const blocked = waiting || disabled;

  const submit = () => {
    const value = text.trim();
    if (!value || blocked) return;
    onSend(value);
    setText("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  // Enter sends; Shift+Enter (or Enter while an IME is composing) adds a new line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div aria-hidden={!waiting} className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
        {waiting && (
          <>
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/50 motion-reduce:animate-none" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/50 [animation-delay:150ms] motion-reduce:animate-none" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/50 [animation-delay:300ms] motion-reduce:animate-none" />
            </span>
            <span>The assistant is typing…</span>
          </>
        )}
      </div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Your message
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          maxLength={CHAT_MAX_MESSAGE_CHARS}
          rows={2}
          placeholder="Type your answer"
          className="min-h-11 w-full min-w-0 flex-1 resize-y rounded-xl border border-input bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60"
        />
        <Button type="submit" size="lg" disabled={blocked || text.trim() === ""} className="shrink-0 px-4">
          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          Send
        </Button>
      </div>
    </form>
  );
}
