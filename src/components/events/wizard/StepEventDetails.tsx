'use client';

import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import type { WizardFormData, RegistryLinkEntry } from './WizardContainer';

interface EventDetailsFormValues {
  title: string;
  description: string;
  event_date: string;
  event_end_date: string;
  location_name: string;
  location_address: string;
  host_name: string;
  dress_code: string;
  rsvp_deadline: string;
  max_attendees: string;
  max_guests_per_rsvp: string;
}

interface StepEventDetailsProps {
  data: EventDetailsFormValues;
  registryLinks: RegistryLinkEntry[];
  allowPlusOnes: boolean;
  onUpdate: (field: keyof WizardFormData, value: unknown) => void;
}

const DRESS_CODE_OPTIONS = [
  '',
  'Casual',
  'Smart Casual',
  'Business Casual',
  'Semi-Formal',
  'Cocktail Attire',
  'Black Tie',
  'White Tie',
  'Festive / Theme',
];

export default function StepEventDetails({ data, registryLinks, allowPlusOnes, onUpdate }: StepEventDetailsProps) {
  const [regLabel, setRegLabel] = useState('');
  const [regUrl, setRegUrl] = useState('');
  const [regError, setRegError] = useState('');

  const addRegistryLink = () => {
    if (!regLabel.trim()) { setRegError('Label is required'); return; }
    if (!regUrl.trim()) { setRegError('URL is required'); return; }
    try { new URL(regUrl); } catch { setRegError('Please enter a valid URL'); return; }
    setRegError('');
    onUpdate('registry_links', [...registryLinks, { label: regLabel.trim(), url: regUrl.trim() }]);
    setRegLabel('');
    setRegUrl('');
  };

  const removeRegistryLink = (index: number) => {
    onUpdate('registry_links', registryLinks.filter((_, i) => i !== index));
  };
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<EventDetailsFormValues>({
    defaultValues: data,
    mode: 'onChange',
  });

  const watchedValues = watch();

  useEffect(() => {
    const fields: (keyof EventDetailsFormValues)[] = [
      'title',
      'description',
      'event_date',
      'event_end_date',
      'location_name',
      'location_address',
      'host_name',
      'dress_code',
      'rsvp_deadline',
    ];

    fields.forEach((field) => {
      if (watchedValues[field] !== data[field]) {
        onUpdate(field, watchedValues[field]);
      }
    });

    // Sync numeric fields (convert string to number/null for API)
    if (watchedValues.max_attendees !== data.max_attendees) {
      const val = watchedValues.max_attendees;
      onUpdate('max_attendees', val ? parseInt(val, 10) || null : null);
    }
    if (watchedValues.max_guests_per_rsvp !== data.max_guests_per_rsvp) {
      const val = watchedValues.max_guests_per_rsvp;
      onUpdate('max_guests_per_rsvp', val ? parseInt(val, 10) || 10 : 10);
    }
  }, [watchedValues, data, onUpdate]);

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="pb-4">
        <h2 className="text-3xl font-bold text-gray-900">Event Details</h2>
        <p className="mt-3 text-lg text-gray-500">
          Tell us about your event — these details will appear on your invitation.
        </p>
      </div>

      {/* ── Section: The Basics ─────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/40 px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">The Basics</h3>
        </div>
        <div className="space-y-6 p-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-base font-semibold text-gray-800">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              {...register('title', {
                required: 'Event title is required',
                minLength: { value: 2, message: 'Title must be at least 2 characters' },
                maxLength: { value: 200, message: 'Title must be less than 200 characters' },
              })}
              placeholder="e.g. Sarah & Tom's Wedding Reception"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-4 text-lg font-medium outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
            />
            {errors.title && (
              <p className="mt-2 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-base font-semibold text-gray-800">
              Description
            </label>
            <textarea
              id="description"
              {...register('description', {
                maxLength: { value: 2000, message: 'Description must be less than 2000 characters' },
              })}
              rows={4}
              placeholder="Tell your guests what to expect — share the vibe, the plan, or a personal message..."
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
            />
            {errors.description && (
              <p className="mt-2 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Hosted By */}
          <div>
            <label htmlFor="host_name" className="block text-base font-semibold text-gray-800">
              Hosted By
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <input
                id="host_name"
                type="text"
                {...register('host_name')}
                placeholder="e.g. Sarah & Tom, The Smith Family"
                className="w-full rounded-xl border border-gray-300 py-4 pl-11 pr-4 text-base outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Date & Time ────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-cyan-50/40 px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Date & Time</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="event_date" className="block text-sm font-medium text-gray-700">
                Starts
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <input
                  id="event_date"
                  type="datetime-local"
                  {...register('event_date')}
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="event_end_date" className="block text-sm font-medium text-gray-700">
                Ends
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <input
                  id="event_end_date"
                  type="datetime-local"
                  {...register('event_end_date')}
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Location ───────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/40 px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Location</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="location_name" className="block text-sm font-medium text-gray-700">
                Venue Name
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5z" />
                  </svg>
                </div>
                <input
                  id="location_name"
                  type="text"
                  {...register('location_name')}
                  placeholder="e.g. Grand Ballroom, Riverside Park"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location_address" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <input
                  id="location_address"
                  type="text"
                  {...register('location_address')}
                  placeholder="e.g. 123 Main St, City, State"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Extra Details ──────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-amber-50/80 to-orange-50/40 px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Extra Details</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Dress Code */}
            <div>
              <label htmlFor="dress_code" className="block text-sm font-medium text-gray-700">
                Dress Code
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <select
                  id="dress_code"
                  {...register('dress_code')}
                  className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-10 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">No dress code</option>
                  {DRESS_CODE_OPTIONS.filter(Boolean).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* RSVP Deadline */}
            <div>
              <label htmlFor="rsvp_deadline" className="block text-sm font-medium text-gray-700">
                RSVP Deadline
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <input
                  id="rsvp_deadline"
                  type="datetime-local"
                  {...register('rsvp_deadline')}
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Guest Limits ─────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-violet-50/80 to-purple-50/40 px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Guest Limits</h3>
        </div>
        <div className="p-5 space-y-5">
          <p className="text-xs text-gray-500">Control how many people can attend and whether guests can bring others.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Max total attendees */}
            <div>
              <label htmlFor="max_attendees" className="block text-sm font-medium text-gray-700">
                Max Total Attendees
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <input
                  id="max_attendees"
                  type="number"
                  min="1"
                  max="10000"
                  {...register('max_attendees')}
                  placeholder="No limit"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder:text-gray-400"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Leave empty for unlimited</p>
            </div>

            {/* Max guests per RSVP */}
            <div>
              <label htmlFor="max_guests_per_rsvp" className="block text-sm font-medium text-gray-700">
                Max Guests per RSVP
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <input
                  id="max_guests_per_rsvp"
                  type="number"
                  min="1"
                  max="50"
                  {...register('max_guests_per_rsvp')}
                  placeholder="10"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder:text-gray-400"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">How many people each respondent can bring</p>
            </div>
          </div>

          {/* Allow +1s toggle */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Allow +1s (Additional Guests)</p>
              <p className="mt-0.5 text-xs text-gray-500">Let guests bring additional people when they RSVP</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate('allow_plus_ones', !allowPlusOnes)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                allowPlusOnes ? 'bg-violet-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  allowPlusOnes ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Section: Gift Registries ────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-pink-50/80 to-rose-50/40 px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Gift Registries</h3>
          {registryLinks.length > 0 && (
            <span className="ml-auto rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
              {registryLinks.length}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Add links to gift registries — they will appear on your public event page.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={regLabel}
              onChange={(e) => setRegLabel(e.target.value)}
              placeholder="e.g. Amazon Wishlist"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 placeholder:text-gray-400"
            />
            <input
              type="url"
              value={regUrl}
              onChange={(e) => setRegUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={addRegistryLink}
              className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pink-700 active:bg-pink-800"
            >
              Add
            </button>
          </div>
          {regError && <p className="text-xs text-red-600">{regError}</p>}

          {registryLinks.length > 0 && (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {registryLinks.map((link, index) => (
                <div key={index} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="h-4 w-4 shrink-0 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.886-3.497l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{link.label}</p>
                      <p className="truncate text-xs text-gray-400">{link.url}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRegistryLink(index)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tip */}
      <p className="text-center text-sm text-gray-400">
        All details (except title) are optional — add what fits your event.
      </p>
    </div>
  );
}
