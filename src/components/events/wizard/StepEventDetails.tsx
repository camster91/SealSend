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
      'title', 'description', 'event_date', 'event_end_date',
      'location_name', 'location_address', 'host_name', 'dress_code', 'rsvp_deadline',
    ];

    fields.forEach((field) => {
      if (watchedValues[field] !== data[field]) {
        onUpdate(field, watchedValues[field]);
      }
    });

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Event Details</h2>
        <p className="mt-1 text-gray-600">Tell us about your event.</p>
      </div>

      {/* Basic Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Basic Info</h3>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
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
            placeholder="e.g. Sarah & Tom's Wedding"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            id="description"
            {...register('description', { maxLength: { value: 2000, message: 'Description must be less than 2000 characters' } })}
            rows={3}
            placeholder="Tell your guests what to expect..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label htmlFor="host_name" className="block text-sm font-medium text-gray-700 mb-1">Hosted By</label>
          <input
            id="host_name"
            type="text"
            {...register('host_name')}
            placeholder="e.g. Sarah & Tom"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Date & Time */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Date & Time</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="event_date" className="block text-sm font-medium text-gray-700 mb-1">Starts</label>
            <input
              id="event_date"
              type="datetime-local"
              {...register('event_date')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label htmlFor="event_end_date" className="block text-sm font-medium text-gray-700 mb-1">Ends</label>
            <input
              id="event_end_date"
              type="datetime-local"
              {...register('event_end_date')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Location */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Location</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="location_name" className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
            <input
              id="location_name"
              type="text"
              {...register('location_name')}
              placeholder="e.g. Grand Ballroom"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label htmlFor="location_address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              id="location_address"
              type="text"
              {...register('location_address')}
              placeholder="e.g. 123 Main St, Toronto"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Settings */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dress_code" className="block text-sm font-medium text-gray-700 mb-1">Dress Code</label>
            <select
              id="dress_code"
              {...register('dress_code')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              <option value="">Select...</option>
              {DRESS_CODE_OPTIONS.filter(Boolean).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rsvp_deadline" className="block text-sm font-medium text-gray-700 mb-1">RSVP Deadline</label>
            <input
              id="rsvp_deadline"
              type="datetime-local"
              {...register('rsvp_deadline')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="max_attendees" className="block text-sm font-medium text-gray-700 mb-1">Max Attendees</label>
            <input
              id="max_attendees"
              type="number"
              min="1"
              max="10000"
              {...register('max_attendees')}
              placeholder="No limit"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label htmlFor="max_guests_per_rsvp" className="block text-sm font-medium text-gray-700 mb-1">Max Guests per RSVP</label>
            <input
              id="max_guests_per_rsvp"
              type="number"
              min="1"
              max="50"
              {...register('max_guests_per_rsvp')}
              placeholder="10"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Allow +1s</p>
            <p className="text-xs text-gray-500">Let guests bring additional people</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdate('allow_plus_ones', !allowPlusOnes)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${allowPlusOnes ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${allowPlusOnes ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Gift Registries */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Gift Registries</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={regLabel}
            onChange={(e) => setRegLabel(e.target.value)}
            placeholder="Label (e.g. Amazon)"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <input
            type="url"
            value={regUrl}
            onChange={(e) => setRegUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-base outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="button"
            onClick={addRegistryLink}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Add
          </button>
        </div>
        {regError && <p className="text-sm text-red-600">{regError}</p>}

        {registryLinks.length > 0 && (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {registryLinks.map((link, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{link.label}</p>
                  <p className="truncate text-xs text-gray-400">{link.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRegistryLink(index)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
