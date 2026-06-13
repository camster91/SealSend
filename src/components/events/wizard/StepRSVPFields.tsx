'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import type { RSVPField } from './WizardContainer';
import { Toggle } from '@/components/ui/Toggle';

interface StepRSVPFieldsProps {
  fields: RSVPField[];
  onUpdate: (fields: RSVPField[]) => void;
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  email: 'bg-purple-100 text-purple-700',
  select: 'bg-amber-100 text-amber-700',
  textarea: 'bg-green-100 text-green-700',
  number: 'bg-pink-100 text-pink-700',
  tel: 'bg-cyan-100 text-cyan-700',
};

export default function StepRSVPFields({ fields, onUpdate }: StepRSVPFieldsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFieldEnabled = useCallback(
    (index: number) => {
      const updated = fields.map((f, i) =>
        i === index ? { ...f, is_enabled: !f.is_enabled } : f
      );
      onUpdate(updated);
    },
    [fields, onUpdate]
  );

  const toggleFieldRequired = useCallback(
    (index: number) => {
      const updated = fields.map((f, i) =>
        i === index ? { ...f, is_required: !f.is_required } : f
      );
      onUpdate(updated);
    },
    [fields, onUpdate]
  );

  const updateFieldPlaceholder = useCallback(
    (index: number, placeholder: string) => {
      const updated = fields.map((f, i) =>
        i === index ? { ...f, placeholder } : f
      );
      onUpdate(updated);
    },
    [fields, onUpdate]
  );

  const updateFieldOptions = useCallback(
    (index: number, options: string[]) => {
      const updated = fields.map((f, i) =>
        i === index ? { ...f, options } : f
      );
      onUpdate(updated);
    },
    [fields, onUpdate]
  );

  const addOption = useCallback(
    (fieldIndex: number) => {
      const field = fields[fieldIndex];
      const currentOptions = field.options ?? [];
      updateFieldOptions(fieldIndex, [...currentOptions, '']);
    },
    [fields, updateFieldOptions]
  );

  const removeOption = useCallback(
    (fieldIndex: number, optionIndex: number) => {
      const field = fields[fieldIndex];
      const currentOptions = field.options ?? [];
      updateFieldOptions(
        fieldIndex,
        currentOptions.filter((_, i) => i !== optionIndex)
      );
    },
    [fields, updateFieldOptions]
  );

  const updateOptionValue = useCallback(
    (fieldIndex: number, optionIndex: number, value: string) => {
      const field = fields[fieldIndex];
      const currentOptions = [...(field.options ?? [])];
      currentOptions[optionIndex] = value;
      updateFieldOptions(fieldIndex, currentOptions);
    },
    [fields, updateFieldOptions]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">RSVP Fields</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure which fields appear on your RSVP form. Toggle fields on/off and customize their settings.
        </p>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.field_name}
            className={cn(
              'rounded-xl border transition-colors',
              field.is_enabled
                ? 'border-gray-200 bg-white'
                : 'border-gray-100 bg-gray-50'
            )}
          >
            {/* Card header */}
            <div className="flex items-center gap-3 p-4">
              {/* Toggle switch */}
              <Toggle
                checked={field.is_enabled}
                onChange={() => toggleFieldEnabled(index)}
              />

              {/* Field label */}
              <span
                className={cn(
                  'flex-1 text-sm font-medium',
                  field.is_enabled ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {field.field_label}
              </span>

              {/* Type badge */}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  FIELD_TYPE_COLORS[field.field_type] || 'bg-gray-100 text-gray-600'
                )}
              >
                {field.field_type}
              </span>

              {/* Expand/collapse button */}
              {field.is_enabled && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className={cn(
                      'h-4 w-4 transition-transform',
                      expandedIndex === index && 'rotate-180'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Expanded settings */}
            {field.is_enabled && expandedIndex === index && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                {/* Required toggle */}
                <Toggle
                  label="Required field"
                  checked={field.is_required}
                  onChange={() => toggleFieldRequired(index)}
                  className="flex-row-reverse justify-between"
                />

                {/* Placeholder for text-like fields */}
                {(field.field_type === 'text' ||
                  field.field_type === 'email' ||
                  field.field_type === 'tel' ||
                  field.field_type === 'textarea') && (
                  <div>
                    <label className="block text-sm text-gray-600">Placeholder text</label>
                    <input
                      type="text"
                      value={field.placeholder ?? ''}
                      onChange={(e) => updateFieldPlaceholder(index, e.target.value)}
                      placeholder="Enter placeholder text..."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                )}

                {/* Options editor for select fields */}
                {field.field_type === 'select' && (
                  <div>
                    <label className="block text-sm text-gray-600">Options</label>
                    <div className="mt-2 space-y-2">
                      {(field.options ?? []).map((option, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) =>
                              updateOptionValue(index, optIdx, e.target.value)
                            }
                            placeholder={`Option ${optIdx + 1}`}
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optIdx)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(index)}
                        className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add option
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        Enabled fields will appear on the public RSVP form. Guests will fill these in when responding to your event.
      </div>
    </div>
  );
}
