'use client';

import { useState, useCallback } from 'react';
import type { WizardFormData } from './WizardContainer';
import AIPromptGenerator from './AIPromptGenerator';

export interface EventDetailsForPrompt {
  title: string;
  description: string;
  event_date: string;
  event_end_date: string;
  location_name: string;
  location_address: string;
  host_name: string;
  dress_code: string;
  rsvp_deadline: string;
}

interface StepDesignUploadProps {
  designUrl: string;
  designType: string;
  onUpdate: (field: keyof WizardFormData, value: unknown) => void;
  eventDetails?: EventDetailsForPrompt;
}

function isVideoType(type: string) {
  return type === 'video';
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm)$/i.test(url);
}

export default function StepDesignUpload({
  designUrl,
  designType,
  onUpdate,
  eventDetails,
}: StepDesignUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const activeMode = designType === 'video' ? 'video' : designType === 'url' ? 'url' : 'upload';

  const handleFileUpload = useCallback(
    async (file: File, mode: 'image' | 'video') => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadUrl = mode === 'video' ? '/api/upload?type=video' : '/api/upload';
        const res = await fetch(uploadUrl, { method: 'POST', body: formData });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();
        onUpdate('design_url', data.url);
        onUpdate('design_type', mode === 'video' ? 'video' : 'upload');
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    [onUpdate]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, activeMode === 'video' ? 'video' : 'image');
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file, activeMode === 'video' ? 'video' : 'image');
    },
    [handleFileUpload, activeMode]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const removeDesign = () => {
    onUpdate('design_url', '');
    onUpdate('design_type', 'upload');
  };

  const setMode = (mode: 'upload' | 'video' | 'url') => {
    onUpdate('design_type', mode);
    if (designUrl) {
      onUpdate('design_url', '');
    }
  };

  const showVideoPreview = isVideoType(designType) || isVideoUrl(designUrl);
  const acceptTypes =
    activeMode === 'video'
      ? 'video/mp4,video/webm'
      : 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload Your Design</h2>
        <p className="mt-2 text-base text-gray-500">
          Add an image or video that will be your invitation&apos;s centerpiece.
        </p>
      </div>

      {/* Design tips */}
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-purple-50/40 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Design tips</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span>
              <a href="https://www.canva.com/invitations/templates/" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700">
                Canva Invitation Templates
              </a>{' '}&mdash; hundreds of free templates to customize
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span>Use the AI prompt generator below to create a unique design with ChatGPT or Gemini</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span><strong>Images:</strong> 1080&times;1350px (portrait) or 1200&times;630px (landscape) &middot; PNG or JPG &middot; max 10MB</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span><strong>Videos:</strong> MP4 or WebM &middot; max 50MB &middot; great for slideshows and animated invitations</span>
          </li>
        </ul>
      </div>

      {/* AI Prompt Generator */}
      <AIPromptGenerator eventDetails={eventDetails} />

      {/* Design type selector */}
      <div className="flex gap-3">
        {(['upload', 'video', 'url'] as const).map((mode) => {
          const labels = { upload: 'Upload Image', video: 'Upload Video', url: 'Image URL' };
          const icons = {
            upload: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
            video: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
            url: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.59',
          };
          const isActive = activeMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={icons[mode]} />
              </svg>
              {labels[mode]}
            </button>
          );
        })}
      </div>

      {activeMode !== 'url' ? (
        <>
          {!designUrl ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
                dragActive
                  ? 'border-brand-500 bg-brand-50 shadow-inner'
                  : 'border-gray-300 bg-gray-50/50 hover:border-brand-300 hover:bg-brand-50/30'
              }`}
            >
              <input
                type="file"
                accept={acceptTypes}
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                  <p className="text-base font-medium text-gray-600">
                    Uploading your {activeMode === 'video' ? 'video' : 'design'}...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      {activeMode === 'video' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-700">
                      Drop your {activeMode === 'video' ? 'video' : 'design'} here, or click to browse
                    </p>
                    <p className="mt-1.5 text-sm text-gray-500">
                      {activeMode === 'video'
                        ? 'MP4 or WebM · Max 50MB'
                        : 'JPEG, PNG, GIF, WebP, or SVG · Max 10MB'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              {showVideoPreview ? (
                <video
                  src={designUrl}
                  controls
                  className="h-auto max-h-[400px] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={designUrl}
                  alt="Event design preview"
                  className="h-auto max-h-[400px] w-full object-contain"
                />
              )}
              <button
                type="button"
                onClick={removeDesign}
                className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition-all hover:bg-black/80 hover:scale-105"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <label htmlFor="design-url" className="block text-sm font-medium text-gray-700">
            Image URL
          </label>
          <input
            id="design-url"
            type="url"
            value={designUrl}
            onChange={(e) => onUpdate('design_url', e.target.value)}
            placeholder="https://example.com/your-design.png"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          {designUrl && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={designUrl}
                alt="Event design preview"
                className="h-auto max-h-[400px] w-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      <p className="text-center text-sm text-gray-400">
        You can skip this step and add a design later.
      </p>
    </div>
  );
}
