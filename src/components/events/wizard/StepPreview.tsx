'use client';

import { useState } from 'react';
import type { WizardFormData } from './WizardContainer';
import { zonedLocalDateTimeToInstant } from '@/lib/datetime';
import { getPublicationReadiness } from '@/lib/publication-readiness';

interface StepPreviewProps {
  formData: WizardFormData;
  onSubmit: (publishOnCreate: boolean) => Promise<void>;
  isSubmitting: boolean;
}

export default function StepPreview({ formData, onSubmit, isSubmitting }: StepPreviewProps) {
  const [publishOnCreate, setPublishOnCreate] = useState(false);

  const { customization } = formData;
  const enabledFields = formData.rsvp_fields.filter((f) => f.is_enabled);
  const publicationReadiness = getPublicationReadiness({
    title: formData.title,
    event_date: formData.event_date,
    event_end_date: formData.event_end_date,
    location_name: formData.location_name,
    max_attendees: formData.max_attendees,
    invitation_headline: formData.invitation_headline,
    invitation_body: formData.invitation_body,
    rsvp_deadline: formData.rsvp_deadline,
  });

  const buttonBorderRadius =
    customization.buttonStyle === 'pill'
      ? '9999px'
      : customization.buttonStyle === 'square'
        ? '0px'
        : '8px';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      return new Date(zonedLocalDateTimeToInstant(dateStr, formData.event_timezone)).toLocaleString(undefined, {
        timeZone: formData.event_timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Preview & Create</h2>
        <p className="mt-1 text-sm text-gray-500">
          Review how your event page will look to guests.
        </p>
      </div>

      {/* ── Event page preview ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border-2 border-gray-200">
        {/* Preview header label */}
        <div className="bg-gray-100 px-4 py-2 text-xs font-medium text-gray-500">
          Public Event Page Preview
        </div>

        <div
          className="p-6"
          style={{
            backgroundColor: customization.backgroundColor,
            fontFamily: customization.fontFamily,
          }}
        >
          {/* Design image */}
          {formData.design_url && (
            <div className="mb-6 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formData.design_url}
                alt="Event design"
                className="h-auto w-full object-contain"
              />
            </div>
          )}

          {/* Event title */}
          <h3
            className="text-2xl font-bold"
            style={{ color: customization.primaryColor }}
          >
            {formData.title || 'Untitled Event'}
          </h3>

          {/* Description */}
          {formData.description && (
            <p className="mt-3 text-sm text-gray-600">{formData.description}</p>
          )}

          {/* Date and location */}
          <div className="mt-4 space-y-2">
            {formData.event_date && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>{formatDate(formData.event_date)}</span>
              </div>
            )}
            {formData.location_name && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>
                  {formData.location_name}
                  {formData.location_address && ` - ${formData.location_address}`}
                </span>
              </div>
            )}
          </div>

          {/* Countdown preview */}
          {customization.showCountdown && formData.event_date && (
            <div className="mt-5 flex gap-3">
              {['--', '--', '--', '--'].map((val, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-lg p-2"
                  style={{ backgroundColor: `${customization.primaryColor}15` }}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: customization.primaryColor }}
                  >
                    {val}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {['Days', 'Hrs', 'Min', 'Sec'][i]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* RSVP form preview */}
          {enabledFields.length > 0 && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white/80 p-4">
              <h4 className="text-sm font-semibold text-gray-800">RSVP</h4>
              <div className="mt-3 space-y-3">
                {enabledFields.map((field) => (
                  <div key={field.field_name}>
                    <label className="block text-xs font-medium text-gray-600">
                      {field.field_label}
                      {field.is_required && <span className="text-red-500"> *</span>}
                    </label>
                    {field.field_type === 'select' ? (
                      <select
                        disabled
                        className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-400"
                      >
                        <option>Select...</option>
                        {(field.options ?? []).map((opt, i) => (
                          <option key={i}>{opt}</option>
                        ))}
                      </select>
                    ) : field.field_type === 'textarea' ? (
                      <textarea
                        disabled
                        rows={2}
                        placeholder={field.placeholder ?? ''}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-400"
                      />
                    ) : (
                      <input
                        disabled
                        type={field.field_type}
                        placeholder={field.placeholder ?? ''}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled
                className="mt-4 w-full px-4 py-2 text-sm font-medium text-white"
                style={{
                  backgroundColor: customization.primaryColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                Submit RSVP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        {!publicationReadiness.ready && (
          <div id="publication-requirements" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Complete before publishing</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {publicationReadiness.blockers.map((blocker) => <li key={blocker.field}>{blocker.message}</li>)}
            </ul>
            <p className="mt-2 text-xs">You can still save this event as a private draft.</p>
          </div>
        )}
        {/* Publish toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <span className="text-sm font-medium text-gray-900">
              Publish immediately
            </span>
            <p className="text-xs text-gray-500">
              Make your event page publicly accessible right away
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publishOnCreate}
            aria-describedby={!publicationReadiness.ready ? "publication-requirements" : undefined}
            disabled={!publicationReadiness.ready}
            onClick={() => setPublishOnCreate(!publishOnCreate)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              publishOnCreate ? 'bg-brand-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                publishOnCreate ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={() => onSubmit(publishOnCreate)}
          disabled={isSubmitting || !formData.title.trim() || (publishOnCreate && !publicationReadiness.ready)}
          className="w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creating Event...
            </span>
          ) : (
            `Create Event${publishOnCreate ? ' & Publish' : ''}`
          )}
        </button>
      </div>
    </div>
  );
}
