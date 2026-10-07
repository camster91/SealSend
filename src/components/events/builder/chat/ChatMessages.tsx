"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/event-builder/chat-client";

export interface ChatLogMessage extends ChatMessage {
  id: number;
}

interface ChatMessagesProps {
  messages: ChatLogMessage[];
}

/** The conversation log. Only the newest assistant message is announced, so the host's own words aren't read back. */
export function ChatMessages({ messages }: ChatMessagesProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLLIElement>(null);
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [lastId, reduceMotion]);

  return (
    <div>
      <ol aria-label="Conversation" className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <li
            key={m.id}
            ref={i === messages.length - 1 ? endRef : undefined}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-base leading-relaxed",
                m.role === "user"
                  ? "rounded-br-md bg-ink text-white"
                  : "rounded-bl-md border border-border bg-white text-ink",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.text}
            </p>
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {latestAssistant?.text ?? ""}
      </p>
    </div>
  );
}
