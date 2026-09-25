'use client';

import { useReducer, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DEFAULT_RSVP_FIELDS } from '@/lib/constants';
import StepDesignUpload from './StepDesignUpload';
import StepEventDetails from './StepEventDetails';
import StepGuests from './StepGuests';
import StepCustomize from './StepCustomize';
import StepRSVPFields from './StepRSVPFields';
import StepPreview from './StepPreview';
import { PromptToEventGenerator } from './PromptToEventGenerator';
import type { AiEventDraft } from '@/lib/ai/event-draft-schema';
import { instantToZonedLocalDateTime, zonedLocalDateTimeToInstant } from '@/lib/datetime';
import { getEventBriefContext, type EventBrief, type EventBriefContext } from '@/lib/event-brief';

// ── Types ──────────────────────────────────────────────────────────────

export interface RSVPField {
  field_name: string;
  field_type: string;
  field_label: string;
  is_required: boolean;
  is_enabled: boolean;
  options?: string[] | null;
  placeholder?: string | null;
}

export interface EventCustomization {
  primaryColor: string;
  backgroundColor: string;
  backgroundImage: string;
  fontFamily: string;
  buttonStyle: string;
  showCountdown: boolean;
  audioUrl: string;
  logoUrl: string;
  imageFit?: 'contain' | 'cover';
  imagePosition?: 'top' | 'center' | 'bottom';
}

export interface RegistryLinkEntry {
  label: string;
  url: string;
}

export interface WizardFormData {
  title: string;
  description: string;
  event_date: string;
  event_end_date: string;
  event_timezone: string;
  location_name: string;
  location_address: string;
  host_name: string;
  dress_code: string;
  rsvp_deadline: string;
  registry_links: RegistryLinkEntry[];
  max_attendees: number | null;
  allow_plus_ones: boolean;
  max_guests_per_rsvp: number;
  design_url: string;
  design_type: string;
  invitation_headline: string;
  invitation_body: string;
  reminder_sequence: Array<{ timing: string; subject: string; message: string }>;
  event_brief: EventBriefContext | null;
  ai_generation_id: string;
  customization: EventCustomization;
  rsvp_fields: RSVPField[];
  guests: { name: string; email: string }[];
}

type WizardAction =
  | { type: 'UPDATE_FIELD'; field: keyof WizardFormData; value: unknown }
  | { type: 'UPDATE_CUSTOMIZATION'; field: keyof EventCustomization; value: unknown }
  | { type: 'SET_RSVP_FIELDS'; fields: RSVPField[] }
  | { type: 'SET_GUESTS'; guests: { name: string; email: string }[] }
  | { type: 'LOAD_DATA'; data: Partial<WizardFormData> };

interface WizardContainerProps {
  mode?: 'create' | 'edit';
  eventId?: string;
  initialData?: Partial<WizardFormData>;
  draftKey?: string;
  /** Team workspace the new event belongs to; omitted for the host's personal workspace. */
  organizationId?: string;
}

// ── Steps config ───────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: 'Details' },
  { number: 2, label: 'Design' },
  { number: 3, label: 'Guests' },
  { number: 4, label: 'Customize' },
  { number: 5, label: 'RSVP Fields' },
  { number: 6, label: 'Preview' },
] as const;

// ── Default form state ─────────────────────────────────────────────────

function getInitialState(initialData?: Partial<WizardFormData>): WizardFormData {
  const defaultRsvpFields: RSVPField[] = DEFAULT_RSVP_FIELDS.map((f) => ({
    field_name: f.field_name,
    field_type: f.field_type,
    field_label: f.field_label,
    is_required: f.is_required,
    is_enabled: f.is_enabled,
    options: f.options ?? null,
    placeholder: f.placeholder ?? null,
  }));

  return {
    title: '',
    description: '',
    event_date: '',
    event_end_date: '',
    event_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    location_name: '',
    location_address: '',
    host_name: '',
    dress_code: '',
    rsvp_deadline: '',
    registry_links: [],
    max_attendees: null,
    allow_plus_ones: true,
    max_guests_per_rsvp: 10,
    design_url: '',
    design_type: 'upload',
    invitation_headline: '',
    invitation_body: '',
    reminder_sequence: [],
    event_brief: null,
    ai_generation_id: '',
    customization: {
      primaryColor: '#6366f1',
      backgroundColor: '#ffffff',
      backgroundImage: '',
      fontFamily: 'Inter',
      buttonStyle: 'rounded',
      showCountdown: true,
      audioUrl: '',
      logoUrl: '',
      imageFit: 'contain',
      imagePosition: 'center',
    },
    rsvp_fields: defaultRsvpFields,
    guests: [],
    ...initialData,
  };
}

// ── Reducer ────────────────────────────────────────────────────────────

function wizardReducer(state: WizardFormData, action: WizardAction): WizardFormData {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };

    case 'UPDATE_CUSTOMIZATION':
      return {
        ...state,
        customization: {
          ...state.customization,
          [action.field]: action.value,
        },
      };

    case 'SET_RSVP_FIELDS':
      return { ...state, rsvp_fields: action.fields };

    case 'SET_GUESTS':
      return { ...state, guests: action.guests };

    case 'LOAD_DATA':
      return { ...state, ...action.data };

    default:
      return state;
  }
}

// ── localStorage Key ───────────────────────────────────────────────────

const STORAGE_KEY = 'sealsend_event_wizard_draft';

// ── Component ──────────────────────────────────────────────────────────

export default function WizardContainer({
  mode = 'create',
  eventId,
  initialData,
  draftKey,
  organizationId,
}: WizardContainerProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, dispatch] = useReducer(wizardReducer, getInitialState(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [aiBaseline, setAiBaseline] = useState<Partial<WizardFormData> | null>(null);
  const storageKey = draftKey ? `${STORAGE_KEY}_${draftKey}` : STORAGE_KEY;

  // Load from localStorage on mount (only for create mode)
  useEffect(() => {
    if (mode === 'create' && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          dispatch({ type: 'LOAD_DATA', data: parsed });
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
    setIsHydrated(true);
  }, [mode, storageKey]);

  // Save to localStorage whenever formData changes (only for create mode), debounced
  useEffect(() => {
    if (mode === 'create' && isHydrated && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData, mode, isHydrated, storageKey]);

  // Auto-save indicator
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  useEffect(() => {
    if (isHydrated && mode === 'create') {
      setLastSaved(new Date());
    }
  }, [formData, isHydrated, mode]);

  const updateField = useCallback(
    (field: keyof WizardFormData, value: unknown) => {
      dispatch({ type: 'UPDATE_FIELD', field, value });
    },
    []
  );

  const updateCustomization = useCallback(
    (field: keyof EventCustomization, value: unknown) => {
      dispatch({ type: 'UPDATE_CUSTOMIZATION', field, value });
    },
    []
  );

  const setRsvpFields = useCallback((fields: RSVPField[]) => {
    dispatch({ type: 'SET_RSVP_FIELDS', fields });
  }, []);

  const setGuests = useCallback((guests: { name: string; email: string }[]) => {
    dispatch({ type: 'SET_GUESTS', guests });
  }, []);

  const applyAiDraft = useCallback((draft: AiEventDraft, generationId: string, brief: EventBrief) => {
    const timeZone = draft.event.eventTimezone;
    const appliedData: Partial<WizardFormData> = {
      title: draft.event.title,
      description: draft.event.description,
      event_date: draft.event.eventDate ? instantToZonedLocalDateTime(draft.event.eventDate, timeZone) : '',
      event_end_date: draft.event.eventEndDate ? instantToZonedLocalDateTime(draft.event.eventEndDate, timeZone) : '',
      event_timezone: timeZone,
      location_name: draft.event.locationName ?? '',
      location_address: draft.event.locationAddress ?? '',
      host_name: draft.event.hostName ?? '',
      dress_code: draft.event.dressCode ?? '',
      rsvp_deadline: draft.event.rsvpDeadline ? instantToZonedLocalDateTime(draft.event.rsvpDeadline, timeZone) : '',
      max_attendees: draft.event.maxAttendees,
      allow_plus_ones: draft.event.allowPlusOnes,
      max_guests_per_rsvp: draft.event.maxGuestsPerRsvp,
      invitation_headline: draft.invitation.headline,
      invitation_body: draft.invitation.body,
      reminder_sequence: draft.reminders,
      ai_generation_id: generationId,
      event_brief: getEventBriefContext(brief),
      customization: { ...formData.customization, primaryColor: draft.theme.primaryColor, backgroundColor: draft.theme.backgroundColor },
      rsvp_fields: draft.rsvpFields.map((field) => ({
        field_name: field.key,
        field_type: field.type === 'phone' ? 'tel' : field.type === 'multiselect' ? 'select' : field.type,
        field_label: field.label,
        is_required: field.required,
        is_enabled: true,
        options: field.options.length ? field.options : null,
        placeholder: null,
      })),
    };
    dispatch({ type: 'LOAD_DATA', data: appliedData });
    setAiBaseline(appliedData);
  }, [formData.customization]);

  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = async (publishOnCreate: boolean = false) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        event_date: formData.event_date ? zonedLocalDateTimeToInstant(formData.event_date, formData.event_timezone) : undefined,
        event_end_date: formData.event_end_date ? zonedLocalDateTimeToInstant(formData.event_end_date, formData.event_timezone) : undefined,
        event_timezone: formData.event_timezone,
        location_name: formData.location_name || undefined,
        location_address: formData.location_address || undefined,
        host_name: formData.host_name || undefined,
        dress_code: formData.dress_code || undefined,
        rsvp_deadline: formData.rsvp_deadline ? zonedLocalDateTimeToInstant(formData.rsvp_deadline, formData.event_timezone) : undefined,
        registry_links: formData.registry_links.length > 0 ? formData.registry_links : undefined,
        max_attendees: formData.max_attendees,
        allow_plus_ones: formData.allow_plus_ones,
        max_guests_per_rsvp: formData.max_guests_per_rsvp,
        design_url: formData.design_url || undefined,
        design_type: formData.design_type || 'upload',
        customization: formData.customization,
        invitation_headline: formData.invitation_headline || undefined,
        invitation_body: formData.invitation_body || undefined,
        reminder_sequence: formData.reminder_sequence,
        event_brief: formData.event_brief,
        ai_generation_id: formData.ai_generation_id || undefined,
        ai_edit_count: aiBaseline ? Object.entries(aiBaseline).filter(([key, value]) => JSON.stringify(formData[key as keyof WizardFormData]) !== JSON.stringify(value)).length : undefined,
        status: publishOnCreate ? 'published' : 'draft',
      };

      let eventResponse;

      if (mode === 'edit' && eventId) {
        const res = await fetch(`/api/events/${eventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update event');
        }

        eventResponse = await res.json();

        // Update RSVP fields
        const rsvpRes = await fetch(`/api/events/${eventId}/rsvp-fields`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData.rsvp_fields),
        });
        if (!rsvpRes.ok) {
          const error = await rsvpRes.json().catch(() => ({}));
          throw new Error(error.error || 'The event was saved, but its RSVP fields could not be updated. Please retry.');
        }
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(organizationId ? { ...payload, organization_id: organizationId } : payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create event');
        }

        eventResponse = await res.json();

        // Update RSVP fields if different from defaults
        const rsvpRes = await fetch(`/api/events/${eventResponse.id}/rsvp-fields`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData.rsvp_fields),
        });
        if (!rsvpRes.ok) {
          const error = await rsvpRes.json().catch(() => ({}));
          throw new Error(error.error || 'The event was created, but its RSVP fields could not be saved. Please retry from the event editor.');
        }
      }

      // Bulk-create guests if any were added during wizard
      if (formData.guests.length > 0) {
        const guestRes = await fetch(`/api/events/${eventResponse.id}/guests/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            formData.guests.map((g) => ({
              name: g.name,
              email: g.email || undefined,
            }))
          ),
        });
        if (!guestRes.ok) {
          const error = await guestRes.json().catch(() => ({}));
          throw new Error(error.error || 'The event was saved, but its guest list could not be imported. Please retry from Guests.');
        }
      }

      router.push(`/events/${eventResponse.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render step content ──────────────────────────────────────────────

  function renderStep() {
    switch (currentStep) {
      case 1:
        return (
          <>
          {mode === 'create' && <PromptToEventGenerator timezone={formData.event_timezone} onApply={applyAiDraft} />}
          <StepEventDetails
            data={{
              title: formData.title,
              description: formData.description,
              invitation_headline: formData.invitation_headline,
              invitation_body: formData.invitation_body,
              event_date: formData.event_date,
              event_end_date: formData.event_end_date,
              location_name: formData.location_name,
              location_address: formData.location_address,
              host_name: formData.host_name,
              dress_code: formData.dress_code,
              rsvp_deadline: formData.rsvp_deadline,
              max_attendees: formData.max_attendees?.toString() ?? '',
              max_guests_per_rsvp: formData.max_guests_per_rsvp?.toString() ?? '10',
              audience: formData.event_brief?.audience ?? '',
              accessibility_status: formData.event_brief?.accessibilityStatus ?? 'not_reviewed',
              accessibility_notes: formData.event_brief?.accessibilityNotes ?? '',
              communication_preference: formData.event_brief?.communicationPreference ?? 'undecided',
            }}
            registryLinks={formData.registry_links}
            allowPlusOnes={formData.allow_plus_ones}
            onUpdate={updateField}
          />
          </>
        );
      case 2:
        return (
          <StepDesignUpload
            designUrl={formData.design_url}
            designType={formData.design_type}
            onUpdate={updateField}
            customization={formData.customization}
          />
        );
      case 3:
        return (
          <StepGuests
            guests={formData.guests}
            onUpdate={setGuests}
          />
        );
      case 4:
        return (
          <StepCustomize
            customization={formData.customization}
            onUpdate={updateCustomization}
          />
        );
      case 5:
        return (
          <StepRSVPFields
            fields={formData.rsvp_fields}
            onUpdate={setRsvpFields}
          />
        );
      case 6:
        return (
          <StepPreview
            formData={formData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* ── Stepper ─────────────────────────────────────────────────── */}
      <nav aria-label="Wizard steps" className="mb-10">
        <ol className="flex items-center justify-between gap-2">
          {STEPS.map((step) => {
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            return (
              <li key={step.number} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2 w-full">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      isActive && 'border-brand-600 bg-brand-600 text-white',
                      isCompleted && 'border-brand-600 bg-brand-100 text-brand-700',
                      !isActive && !isCompleted && 'border-neutral-300 bg-white text-neutral-400'
                    )}
                  >
                    {isCompleted ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium whitespace-nowrap',
                      isActive && 'text-brand-600',
                      isCompleted && 'text-brand-600',
                      !isActive && !isCompleted && 'text-neutral-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {step.number < 6 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-2 -mt-5',
                      currentStep > step.number ? 'bg-brand-600' : 'bg-neutral-200'
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Error message ───────────────────────────────────────────── */}
      {submitError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* ── Step content ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
        {renderStep()}
      </div>

      {/* ── Auto-save indicator ─────────────────────────────────────── */}
      {mode === 'create' && lastSaved && (
        <div className="mt-4 text-center text-xs text-gray-400">
          Saved in this browser at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* ── Navigation buttons ──────────────────────────────────────── */}
      {currentStep < 6 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 1}
            className={cn(
              'rounded-lg px-5 py-2.5 text-sm font-medium transition-colors',
              currentStep === 1
                ? 'cursor-not-allowed text-neutral-300'
                : 'text-neutral-600 hover:bg-neutral-100'
            )}
          >
            Back
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={currentStep === 1 && !formData.title.trim()}
            className={cn(
              'rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700',
              currentStep === 1 && !formData.title.trim() && 'cursor-not-allowed opacity-50'
            )}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
