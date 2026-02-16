'use client';

import { useState } from 'react';

interface ExportToolsProps {
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  eventLocation: string | null;
  eventSlug: string;
  designUrl: string | null;
}

export function ExportTools({
  eventId,
  eventTitle,
  eventDate,
  eventLocation,
  eventSlug,
  designUrl,
}: ExportToolsProps) {
  const [copied, setCopied] = useState(false);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app';
  const rsvpUrl = `${siteUrl}/e/${eventSlug}`;

  function handleDownloadDesign() {
    if (!designUrl) return;
    const a = document.createElement('a');
    a.href = designUrl;
    a.download = `${eventTitle.replace(/\s+/g, '-').toLowerCase()}-design`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleCopyEmailHTML() {
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    const html = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
${designUrl ? `  <img src="${designUrl}" alt="${eventTitle}" style="width:100%;height:auto;border-radius:8px;" />` : ''}
  <h1 style="margin:24px 0 8px;font-size:24px;color:#1f2937;">${eventTitle}</h1>
${formattedDate ? `  <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">${formattedDate}</p>` : ''}
${eventLocation ? `  <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">${eventLocation}</p>` : ''}
  <a href="${rsvpUrl}" style="display:inline-block;padding:12px 32px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">RSVP Now</a>
</div>`;

    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50/50 px-6 py-3.5">
        <h2 className="text-sm font-semibold text-gray-900">Marketing Tools</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {/* Download Design */}
        <button
          type="button"
          onClick={handleDownloadDesign}
          disabled={!designUrl}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Design
        </button>

        {/* Copy Email HTML */}
        <button
          type="button"
          onClick={handleCopyEmailHTML}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          {copied ? 'Copied!' : 'Copy Email HTML'}
        </button>

        {/* Export CSV */}
        <a
          href={`/api/events/${eventId}/export-csv`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export Guest CSV
        </a>
      </div>
    </div>
  );
}
