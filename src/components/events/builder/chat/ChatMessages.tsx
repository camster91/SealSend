"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { latestAssistantGroup, type ChatMessage } from "@/lib/event-builder/chat-client";

export interface ChatLogMessage extends ChatMessage {
  id: number;
}

interface ChatMessagesProps {
  messages: ChatLogMessage[];
}

/** The conversation log. Each turn's assistant messages are announced (all of them), never the host's own words. */
export function ChatMessages({ messages }: ChatMessagesProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLLIElement>(null);
  const announce = latestAssistantGroup(messages);
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
      {/* Each message is its own keyed node, so a new turn is announced even when its words repeat the last one. */}
      <div aria-live="polite" className="sr-only">
        {announce.map((m) => (
          <p key={m.id}>{m.text}</p>
        ))}
      </div>
    </div>
  );
}
