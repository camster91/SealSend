"use client";

import type { BuilderData, BuilderScreen } from "@/lib/event-builder/schema";
import type { EventCustomization } from "@/types/database";
import { BuilderShell } from "./BuilderShell";
import { BasicsScreen } from "./screens/BasicsScreen";
import { GuestsScreen } from "./screens/GuestsScreen";
import { LookScreen } from "./screens/LookScreen";
import { ReviewScreen } from "./screens/ReviewScreen";

export interface EventBuilderProps {
  mode: "create" | "edit";
  eventId?: string;
  initial: BuilderData;
  organizationId?: string;
  templateCustomization?: Partial<EventCustomization>;
  initialStatus?: "draft" | "published";
  initialScreen?: BuilderScreen;
}

/** Client wrapper: server pages can't pass the screens function map, so it lives here. */
export function EventBuilder(props: EventBuilderProps) {
  return (
    <BuilderShell
      {...props}
      screens={{
        basics: (ctx) => <BasicsScreen ctx={ctx} />,
        look: (ctx) => <LookScreen ctx={ctx} />,
        guests: (ctx) => <GuestsScreen ctx={ctx} />,
        review: (ctx) => <ReviewScreen ctx={ctx} />,
      }}
    />
  );
}
