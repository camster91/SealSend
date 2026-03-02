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
    customization: {
      primaryColor: '#6366f1',
      backgroundColor: '#ffffff',
      backgroundImage: '',
      fontFamily: 'Inter',
      buttonStyle: 'rounded',
      showCountdown: true,
      audioUrl: '',
      logoUrl: '',
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
}: WizardContainerProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, dispatch] = useReducer(wizardReducer, getInitialState(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (only for create mode)
  useEffect(() => {
    if (mode === 'create' && typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
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
  }, [mode]);

  // Save to localStorage whenever formData changes (only for create mode)
  useEffect(() => {
    if (mode === 'create' && isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData, mode, isHydrated]);

  // Auto-save indicator
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  useEffect(() => {
    if (isHydrated && mode === 'create') {
      setLastSaved(new Date());
    }
  }, [formData, isHydrated, mode]);

  // Clear localStorage on successful submit
  const clearStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

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
        event_date: formData.event_date || undefined,
        event_end_date: formData.event_end_date || undefined,
        location_name: formData.location_name || undefined,
        location_address: formData.location_address || undefined,
        host_name: formData.host_name || undefined,
        dress_code: formData.dress_code || undefined,
        rsvp_deadline: formData.rsvp_deadline || undefined,
        registry_links: formData.registry_links.length > 0 ? formData.registry_links : undefined,
        max_attendees: formData.max_attendees,
        allow_plus_ones: formData.allow_plus_ones,
        max_guests_per_rsvp: formData.max_guests_per_rsvp,
        design_url: formData.design_url || undefined,
        design_type: formData.design_type || 'upload',
        customization: formData.customization,
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
        await fetch(`/api/events/${eventId}/rsvp-fields`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData.rsvp_fields),
        });
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create event');
        }

        eventResponse = await res.json();

        // Update RSVP fields if different from defaults
        await fetch(`/api/events/${eventResponse.id}/rsvp-fields`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData.rsvp_fields),
        });
      }

      // Bulk-create guests if any were added during wizard
      if (formData.guests.length > 0) {
        await fetch(`/api/events/${eventResponse.id}/guests/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            formData.guests.map((g) => ({
              name: g.name,
              email: g.email || undefined,
            }))
          ),
        });
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
          <StepEventDetails
            data={{
              title: formData.title,
              description: formData.description,
              event_date: formData.event_date,
              event_end_date: formData.event_end_date,
              location_name: formData.location_name,
              location_address: formData.location_address,
              host_name: formData.host_name,
              dress_code: formData.dress_code,
              rsvp_deadline: formData.rsvp_deadline,
              max_attendees: formData.max_attendees?.toString() ?? '',
              max_guests_per_rsvp: formData.max_guests_per_rsvp?.toString() ?? '10',
            }}
            registryLinks={formData.registry_links}
            allowPlusOnes={formData.allow_plus_ones}
            onUpdate={updateField}
          />
        );
      case 2:
        return (
          <StepDesignUpload
            designUrl={formData.design_url}
            designType={formData.design_type}
            onUpdate={updateField}
            eventDetails={{
              title: formData.title,
              description: formData.description,
              event_date: formData.event_date,
              event_end_date: formData.event_end_date,
              location_name: formData.location_name,
              location_address: formData.location_address,
              host_name: formData.host_name,
              dress_code: formData.dress_code,
              rsvp_deadline: formData.rsvp_deadline,
            }}
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
          ✓ Auto-saved at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
