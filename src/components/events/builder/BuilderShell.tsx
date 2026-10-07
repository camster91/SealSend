"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { SaveStatus } from "@/lib/event-builder/save-machine";
import { BUILDER_SCREENS, type BuilderData, type BuilderScreen } from "@/lib/event-builder/schema";
import type { EventCustomization } from "@/types/database";
import { InvitePreview } from "./InvitePreview";
import { SaveIndicator } from "./SaveIndicator";
import { SCREEN_NAMES, StepNav } from "./StepNav";
import { useEventDraft } from "./useEventDraft";

export interface ScreenContext {
  data: BuilderData;
  update(patch: Partial<BuilderData>): void;
  eventId?: string;
  ensureDraft(): Promise<string>;
  fieldErrors: Partial<Record<keyof BuilderData, string>>;
  goTo(screen: BuilderScreen): void;
  mode: "create" | "edit";
  published: boolean;
  /** Called by the Review screen after a successful publish. */
  markPublished(): void;
  /** Sends any waiting change and resolves to the save status it settled on. */
  flush(): Promise<SaveStatus>;
  retry(): void;
  /** Set when Next was pressed on Basics without a name; Basics shows it under the Name field. */
  nameError?: string;
  /** Basics sets this while a published event holds values that are not valid yet; the shell then blocks leaving. */
  setBlocking(blocking: boolean): void;
}

export interface BuilderShellProps {
  mode: "create" | "edit";
  eventId?: string;
  initial: BuilderData;
  organizationId?: string;
  templateCustomization?: Partial<EventCustomization>;
  initialStatus?: "draft" | "published";
  /** The screen to open on (e.g. "review" when the chat hands over); earlier screens count as reached. */
  initialScreen?: BuilderScreen;
  screens: Record<BuilderScreen, (ctx: ScreenContext) => ReactNode>;
}

/** Renders one screen in its own component so the screen function runs as a child render. */
function ScreenSlot({ render, ctx }: { render: (ctx: ScreenContext) => ReactNode; ctx: ScreenContext }) {
  return <>{render(ctx)}</>;
}

/**
 * Scrolls the page back to the top. The dashboard scrolls inside its own
 * <main> (overflow-y-auto), so window.scrollTo alone does nothing there.
 */
function scrollToTop(from: HTMLElement | null) {
  let node = from?.parentElement ?? null;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) node.scrollTop = 0;
    node = node.parentElement;
  }
  window.scrollTo?.({ top: 0 });
}

const SLIDE_SECONDS = 0.25;
const SLIDE_DISTANCE = 40;

export function BuilderShell({
  mode,
  eventId: initialEventId,
  initial,
  organizationId,
  templateCustomization,
  initialStatus = "draft",
  initialScreen = "basics",
  screens,
}: BuilderShellProps) {
  const draft = useEventDraft({ eventId: initialEventId, initial, organizationId, templateCustomization });
  const reduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<BuilderScreen>(initialScreen);
  const [reached, setReached] = useState(() => BUILDER_SCREENS.indexOf(initialScreen));
  const [direction, setDirection] = useState(1);
  const [published, setPublished] = useState(initialStatus === "published");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [blocking, setBlocking] = useState(false);
  const moved = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const index = BUILDER_SCREENS.indexOf(screen);
  const next = BUILDER_SCREENS[index + 1] as BuilderScreen | undefined;
  const back = BUILDER_SCREENS[index - 1] as BuilderScreen | undefined;

  const goTo = useCallback((target: BuilderScreen) => {
    const to = BUILDER_SCREENS.indexOf(target);
    moved.current = true;
    setDirection(to >= index ? 1 : -1);
    setScreen(target);
    setReached((r) => Math.max(r, to));
    scrollToTop(rootRef.current);
  }, [index]);

  // Runs when a screen mounts. After the host has moved, focus its h1 so screen readers announce it.
  const focusHeading = useCallback((node: HTMLDivElement | null) => {
    if (!node || !moved.current) return;
    const heading = node.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, []);

  const ctx: ScreenContext = {
    data: draft.data,
    update: draft.update,
    eventId: draft.eventId,
    ensureDraft: draft.ensureDraft,
    fieldErrors: draft.status.kind === "blocked" ? draft.status.fieldErrors : {},
    goTo,
    mode,
    published,
    markPublished: () => setPublished(true),
    flush: draft.flush,
    retry: draft.retry,
    nameError,
    setBlocking,
  };

  // Next from Basics must not leave a create flow without a server draft.
  const onNext = async () => {
    if (!next) return;
    if (screen === "basics" && !draft.eventId) {
      try {
        await draft.ensureDraft();
      } catch {
        // A blank name gets the inline message; any other failure shows in the save indicator.
        if (!draft.data.title.trim()) setNameError("Add a name for your event.");
        return;
      }
    }
    setNameError(undefined);
    goTo(next);
  };

  const slide = reduceMotion ? 0 : SLIDE_DISTANCE;
  const duration = reduceMotion ? 0 : SLIDE_SECONDS;

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-6xl px-4 pb-4 pt-6 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="mb-2 text-sm font-medium text-muted-foreground">{`Step ${index + 1} of ${BUILDER_SCREENS.length}`}</p>
          <StepNav current={screen} reached={reached} all={mode === "edit"} locked={blocking} onSelect={goTo} />
        </div>
        <SaveIndicator status={draft.status} onRetry={draft.retry} />
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              ref={focusHeading}
              initial={{ opacity: 0, x: slide * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slide * direction }}
              transition={{ duration, ease: "easeOut" }}
            >
              <ScreenSlot render={screens[screen]} ctx={ctx} />
            </motion.div>
          </AnimatePresence>
        </main>

        <aside aria-label="Invite preview" className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
            <InvitePreview data={draft.data} />
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-border bg-cotton px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <p aria-live="polite" className="mb-2 text-sm font-medium text-ink empty:hidden">
          {blocking ? "Fix the highlighted fields before moving on." : ""}
        </p>
        <div className="flex items-center gap-3">
          {back && (
            <Button type="button" variant="outline" size="lg" disabled={blocking} onClick={() => goTo(back)}>
              Back
            </Button>
          )}
          <Button type="button" variant="outline" size="lg" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
            Preview
          </Button>
          {next && (
            <Button type="button" size="lg" className="ml-auto" disabled={blocking} onClick={onNext}>
              {`Next: ${SCREEN_NAMES[next]}`}
            </Button>
          )}
        </div>
      </div>

      <Modal sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview" className="lg:hidden">
        <InvitePreview data={draft.data} />
      </Modal>
    </div>
  );
}
