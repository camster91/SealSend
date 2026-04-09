'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EventDetailsForPrompt } from './StepDesignUpload';

const EVENT_TYPES = [
  'Birthday',
  'Wedding',
  'Baby Shower',
  'Graduation',
  'Corporate Event',
  'Holiday Party',
  'Dinner Party',
  'Anniversary',
  'Other',
] as const;

const STYLES = [
  { label: 'Elegant & Sophisticated', keywords: 'luxurious textures, refined typography spacing, subtle metallic accents, and a sophisticated color harmony' },
  { label: 'Playful & Fun', keywords: 'cheerful illustrations, rounded shapes, confetti-like elements, and lively bursts of color' },
  { label: 'Modern & Minimalist', keywords: 'clean geometric shapes, generous whitespace, sharp lines, and a restrained color palette' },
  { label: 'Rustic & Bohemian', keywords: 'natural textures like wood grain and linen, hand-drawn botanical elements, and warm earthy tones' },
  { label: 'Vintage & Retro', keywords: 'ornate borders, aged paper textures, classic motifs, and a nostalgic muted color scheme' },
  { label: 'Floral & Garden', keywords: 'lush watercolor flowers, leafy greenery borders, soft gradients, and delicate botanical arrangements' },
  { label: 'Bold & Dramatic', keywords: 'high-contrast colors, strong geometric compositions, striking visual weight, and powerful graphic elements' },
  { label: 'Tropical & Vibrant', keywords: 'exotic foliage, bright saturated colors, palm leaves, monstera patterns, and sun-drenched warmth' },
] as const;

interface PromptForm {
  eventType: string;
  style: string;
  colors: string;
  extras: string;
  orientation: 'portrait' | 'landscape';
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function buildPrompt(form: PromptForm, eventDetails?: EventDetailsForPrompt): string {
  const styleObj = STYLES.find((s) => s.label === form.style);
  const dims = form.orientation === 'portrait' ? '1080×1350' : '1200×630';

  const hasDetails = eventDetails && (eventDetails.title || eventDetails.event_date || eventDetails.location_name);

  let prompt = `Create a ${form.style.toLowerCase()} digital invitation card design for a ${form.eventType.toLowerCase()}.

Design specifications:
- Dimensions: ${dims}px, ${form.orientation} orientation
- Color palette: ${form.colors || 'designer\'s choice'}
- Style: ${styleObj?.keywords || form.style.toLowerCase()}`;

  if (form.extras.trim()) {
    prompt += `\n- Special elements: ${form.extras.trim()}`;
  }

  if (hasDetails) {
    prompt += `\n\nINCLUDE the following text on the invitation design, laid out beautifully and legibly:`;

    if (eventDetails.title) {
      prompt += `\n- Event title (prominent): "${eventDetails.title}"`;
    }

    if (eventDetails.description) {
      prompt += `\n- Description: "${eventDetails.description}"`;
    }

    if (eventDetails.event_date) {
      const formatted = formatEventDate(eventDetails.event_date);
      prompt += `\n- Date & time: "${formatted}"`;
    }

    if (eventDetails.event_end_date) {
      const formatted = formatEventDate(eventDetails.event_end_date);
      prompt += `\n- Ends: "${formatted}"`;
    }

    if (eventDetails.location_name) {
      prompt += `\n- Venue: "${eventDetails.location_name}"`;
    }

    if (eventDetails.location_address) {
      prompt += `\n- Address: "${eventDetails.location_address}"`;
    }

    if (eventDetails.host_name) {
      prompt += `\n- Hosted by: "${eventDetails.host_name}"`;
    }

    if (eventDetails.dress_code) {
      prompt += `\n- Dress code: "${eventDetails.dress_code}"`;
    }

    if (eventDetails.rsvp_deadline) {
      const formatted = formatEventDate(eventDetails.rsvp_deadline);
      prompt += `\n- RSVP by: "${formatted}"`;
    }

    prompt += `

Ensure all text is spelled exactly as provided above. Use elegant, readable typography with clear visual hierarchy — the title should be the most prominent, followed by date/time, then venue and address. Host name, dress code, and RSVP deadline should appear as smaller supporting details. The text should be integrated naturally into the design, not floating awkwardly.`;
  } else {
    prompt += `

IMPORTANT: Do NOT include any text, words, letters, or numbers on the design. Leave clean space where text can be overlaid later. The design should be purely decorative/illustrative.`;
  }

  prompt += `

The invitation should feel premium and visually striking, suitable for digital delivery. Use a polished composition with ${styleObj?.keywords || 'attention to detail'}. Output as a high-quality image.`;

  return prompt;
}

interface AIPromptGeneratorProps {
  eventDetails?: EventDetailsForPrompt;
}

export default function AIPromptGenerator({ eventDetails }: AIPromptGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<PromptForm>({
    eventType: EVENT_TYPES[0],
    style: STYLES[0].label,
    colors: '',
    extras: '',
    orientation: 'portrait',
  });
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const updateField = useCallback(<K extends keyof PromptForm>(key: K, value: PromptForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setGeneratedPrompt(null);
    setCopied(false);
  }, []);

  const handleGenerate = () => {
    setGeneratedPrompt(buildPrompt(form, eventDetails));
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!generatedPrompt) return;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generatedPrompt;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        setCopied(true);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-purple-50 p-5 text-left transition-all hover:border-brand-300 hover:shadow-md"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-sm transition-transform group-hover:scale-105">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-gray-900">Generate with AI</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Build a perfect prompt for ChatGPT or Gemini to create your design
          </p>
        </div>
        <svg className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-purple-50 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">AI Prompt Generator</h3>
            <p className="text-sm text-gray-500">
              Describe your vibe and we&apos;ll craft the perfect prompt
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close AI prompt generator"
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {/* Event Type */}
        <div>
          <label htmlFor="ai-event-type" className="block text-sm font-medium text-gray-700">
            What&apos;s the occasion?
          </label>
          <select
            id="ai-event-type"
            value={form.eventType}
            onChange={(e) => updateField('eventType', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Style */}
        <div>
          <label htmlFor="ai-style" className="block text-sm font-medium text-gray-700">
            Pick a style
          </label>
          <select
            id="ai-style"
            value={form.style}
            onChange={(e) => updateField('style', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            {STYLES.map((s) => (
              <option key={s.label} value={s.label}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Colors */}
        <div>
          <label htmlFor="ai-colors" className="block text-sm font-medium text-gray-700">
            Color palette
          </label>
          <input
            id="ai-colors"
            type="text"
            maxLength={100}
            value={form.colors}
            onChange={(e) => updateField('colors', e.target.value)}
            placeholder="e.g. gold and navy blue"
            className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Extras */}
        <div>
          <label htmlFor="ai-extras" className="block text-sm font-medium text-gray-700">
            Special touches <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="ai-extras"
            type="text"
            maxLength={100}
            value={form.extras}
            onChange={(e) => updateField('extras', e.target.value)}
            placeholder="e.g. roses, star patterns, winter theme"
            className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      {/* Orientation toggle */}
      <div className="mt-5">
        <span id="orientation-label" className="block text-sm font-medium text-gray-700">Orientation</span>
        <div className="mt-2 flex gap-3" role="radiogroup" aria-labelledby="orientation-label">
          <button
            type="button"
            role="radio"
            aria-checked={form.orientation === 'portrait'}
            onClick={() => updateField('orientation', 'portrait')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              form.orientation === 'portrait'
                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
            </svg>
            Portrait (1080&times;1350)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={form.orientation === 'landscape'}
            onClick={() => updateField('orientation', 'landscape')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              form.orientation === 'landscape'
                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <svg className="h-4 w-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
            </svg>
            Landscape (1200&times;630)
          </button>
        </div>
      </div>

      {/* Event details preview */}
      {eventDetails && (eventDetails.title || eventDetails.event_date || eventDetails.location_name) ? (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Your event details will be included in the prompt:</p>
          <ul className="mt-2 space-y-1 text-sm text-green-700">
            {eventDetails.title && <li>&bull; Title: {eventDetails.title}</li>}
            {eventDetails.event_date && <li>&bull; Date: {formatEventDate(eventDetails.event_date)}</li>}
            {eventDetails.event_end_date && <li>&bull; Ends: {formatEventDate(eventDetails.event_end_date)}</li>}
            {eventDetails.location_name && <li>&bull; Venue: {eventDetails.location_name}</li>}
            {eventDetails.location_address && <li>&bull; Address: {eventDetails.location_address}</li>}
            {eventDetails.host_name && <li>&bull; Hosted by: {eventDetails.host_name}</li>}
            {eventDetails.dress_code && <li>&bull; Dress code: {eventDetails.dress_code}</li>}
            {eventDetails.rsvp_deadline && <li>&bull; RSVP by: {formatEventDate(eventDetails.rsvp_deadline)}</li>}
          </ul>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            No event details entered yet. Go back to add your title, date, and venue so the AI can include them on the invitation.
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:from-brand-700 hover:to-purple-700 hover:shadow-md"
      >
        Generate Prompt
      </button>

      {/* Output */}
      {generatedPrompt && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {generatedPrompt}
            </pre>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all ${
                copied
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy Prompt
                </>
              )}
            </button>
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:shadow-sm"
            >
              Open ChatGPT
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:shadow-sm"
            >
              Open Gemini
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
