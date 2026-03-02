"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import type { RSVPField, PlusOneData } from "@/types/database";
import { cn } from "@/lib/utils";
import { UserPlus, X } from "lucide-react";

interface RSVPFormProps {
  eventSlug: string;
  fields: RSVPField[];
  primaryColor: string;
  buttonStyle?: "rounded" | "pill" | "square";
  allowPlusOnes?: boolean;
  maxGuestsPerRsvp?: number;
  spotsRemaining?: number | null;
  inviteGuestId?: string;
  inviteGuestName?: string;
  inviteGuestEmail?: string | null;
}

export function RSVPForm({ eventSlug, fields, primaryColor, buttonStyle = "rounded", allowPlusOnes = true, maxGuestsPerRsvp = 10, spotsRemaining = null, inviteGuestId, inviteGuestName, inviteGuestEmail }: RSVPFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [plusOnes, setPlusOnes] = useState<PlusOneData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate current headcount
  const headcount = parseInt(formData["headcount"] || "1", 10) || 1;
  const expectedPlusOnes = Math.max(0, headcount - 1);

  // Pre-fill from invite link (magic link) or signed-in user
  useEffect(() => {
    let cancelled = false;

    // Invite data takes priority
    if (inviteGuestName) {
      setFormData((prev) => ({ ...prev, respondent_name: inviteGuestName }));
    }
    if (inviteGuestEmail) {
      setFormData((prev) => ({ ...prev, email: inviteGuestEmail }));
    }

    // Fall back to auth session if no invite data
    if (!inviteGuestName) {
      async function prefill() {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (cancelled || !user) return;
          const name = user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.email?.split("@")[0]
            || "";
          if (name) {
            setFormData((prev) => ({ ...prev, respondent_name: prev.respondent_name || name }));
          }
          if (user.email) {
            setFormData((prev) => ({ ...prev, email: prev.email || user.email || "" }));
          }
        } catch {
          // Not signed in, that's fine
        }
      }
      prefill();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync plusOnes array with headcount
  useEffect(() => {
    setPlusOnes((prev) => {
      const newPlusOnes = [...prev];
      // Add empty slots if needed
      while (newPlusOnes.length < expectedPlusOnes) {
        newPlusOnes.push({ name: "" });
      }
      // Remove excess slots
      while (newPlusOnes.length > expectedPlusOnes) {
        newPlusOnes.pop();
      }
      return newPlusOnes;
    });
  }, [expectedPlusOnes]);

  const enabledFields = fields
    .filter((f) => f.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  function updateField(name: string, value: string) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function updatePlusOne(index: number, field: keyof PlusOneData, value: string) {
    setPlusOnes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removePlusOne(index: number) {
    setPlusOnes((prev) => prev.filter((_, i) => i !== index));
    // Also reduce headcount
    const newHeadcount = Math.max(1, headcount - 1);
    updateField("headcount", String(newHeadcount));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const attendanceField = enabledFields.find(
      (f) => f.field_type === "attendance"
    );
    const status = attendanceField
      ? formData[attendanceField.field_name] || "attending"
      : "attending";

    const responseData: Record<string, string> = {};
    enabledFields.forEach((field) => {
      if (
        field.field_type !== "attendance" &&
        field.field_name !== "email" &&
        field.field_name !== "headcount"
      ) {
        responseData[field.field_name] = formData[field.field_name] || "";
      }
    });

    // Filter out empty plus ones
    const validPlusOnes = plusOnes.filter((po) => po.name.trim() !== "");

    try {
      const res = await fetch(`/api/rsvp/${eventSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondent_name: formData["name"] || formData["respondent_name"] || "Guest",
          respondent_email: formData["email"] || "",
          status,
          headcount,
          response_data: responseData,
          plus_ones: validPlusOnes,
          ...(inviteGuestId && { guest_id: inviteGuestId }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit RSVP");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800">
          Thank you for your RSVP!
        </h3>
        <p className="mt-1 text-sm text-green-700">
          Your response has been recorded.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">RSVP</h2>
        {spotsRemaining !== null && (
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            spotsRemaining > 10
              ? "bg-green-100 text-green-700"
              : spotsRemaining > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          )}>
            {spotsRemaining > 0 ? `${spotsRemaining} spots left` : "Event full"}
          </span>
        )}
      </div>

      {inviteGuestName && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5">
          <p className="text-sm text-indigo-700">
            Welcome, <strong>{inviteGuestName}</strong>! Your details have been pre-filled.
          </p>
        </div>
      )}

      {/* Always show name field */}
      <Input
        label="Your Name *"
        placeholder="Enter your name"
        value={formData["respondent_name"] || ""}
        onChange={(e) => updateField("respondent_name", e.target.value)}
        required
        autoComplete="name"
      />

      {enabledFields.map((field) => {
        if (field.field_name === "respondent_name") return null;

        switch (field.field_type) {
          case "attendance":
            return (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">
                  {field.field_label}
                  {field.is_required && " *"}
                </label>
                <div className="flex gap-2">
                  {["attending", "not_attending", "maybe"].map((opt) => {
                    const btnRadius = buttonStyle === "pill" ? "9999px" : buttonStyle === "square" ? "0px" : "8px";
                    return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateField(field.field_name, opt)}
                      className={cn(
                        "flex-1 border px-3 py-2 text-sm font-medium transition-colors",
                        formData[field.field_name] === opt
                          ? "text-white"
                          : "border-neutral-200 bg-white hover:bg-neutral-50"
                      )}
                      style={{
                        borderRadius: btnRadius,
                        ...(formData[field.field_name] === opt
                          ? { backgroundColor: primaryColor, borderColor: primaryColor }
                          : {}),
                      }}
                    >
                      {opt === "attending"
                        ? "Attending"
                        : opt === "not_attending"
                          ? "Not Attending"
                          : "Maybe"}
                    </button>
                    );
                  })}
                </div>
              </div>
            );
          case "email":
            return (
              <Input
                key={field.id}
                label={`${field.field_label}${field.is_required ? " *" : ""}`}
                type="email"
                placeholder={field.placeholder || "your@email.com"}
                value={formData[field.field_name] || ""}
                onChange={(e) => updateField(field.field_name, e.target.value)}
                required={field.is_required}
                autoComplete="email"
              />
            );
          case "number": {
            // For headcount field, enforce guest limits
            const isHeadcount = field.field_name === "headcount";
            const effectiveMax = isHeadcount
              ? allowPlusOnes
                ? Math.min(
                    maxGuestsPerRsvp,
                    spotsRemaining !== null ? Math.max(1, spotsRemaining) : maxGuestsPerRsvp
                  )
                : 1
              : 50;

            // If +1s disabled and this is headcount, hide the field
            if (isHeadcount && !allowPlusOnes) {
              return null;
            }

            return (
              <div key={field.id}>
                <Input
                  label={`${field.field_label}${field.is_required ? " *" : ""}`}
                  type="number"
                  min="1"
                  max={String(effectiveMax)}
                  placeholder={field.placeholder || "1"}
                  value={formData[field.field_name] || ""}
                  onChange={(e) => updateField(field.field_name, e.target.value)}
                  required={field.is_required}
                />
                {isHeadcount && spotsRemaining !== null && (
                  <p className="mt-1 text-xs text-gray-500">
                    {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>
            );
          }
          case "select":
            return (
              <Select
                key={field.id}
                label={`${field.field_label}${field.is_required ? " *" : ""}`}
                placeholder="Select an option"
                options={(field.options || []).map((opt) => ({
                  value: opt,
                  label: opt,
                }))}
                value={formData[field.field_name] || ""}
                onChange={(e) => updateField(field.field_name, e.target.value)}
                required={field.is_required}
              />
            );
          case "text":
          default: {
            // Hide plus_one field when headcount is 1 or less
            if (field.field_name === "plus_one") {
              const currentHeadcount = parseInt(formData["headcount"] || "1", 10) || 1;
              if (currentHeadcount <= 1) return null;
            }

            const useTextarea = field.field_name === "message"
              || field.field_name === "dietary"
              || field.field_name === "plus_one";

            return useTextarea ? (
              <Textarea
                key={field.id}
                label={`${field.field_label}${field.is_required ? " *" : ""}`}
                placeholder={field.placeholder || ""}
                value={formData[field.field_name] || ""}
                onChange={(e) => updateField(field.field_name, e.target.value)}
                required={field.is_required}
              />
            ) : (
              <Input
                key={field.id}
                label={`${field.field_label}${field.is_required ? " *" : ""}`}
                placeholder={field.placeholder || ""}
                value={formData[field.field_name] || ""}
                onChange={(e) => updateField(field.field_name, e.target.value)}
                required={field.is_required}
              />
            );
          }
        }
      })}

      {/* Plus One Names Section */}
      {allowPlusOnes && expectedPlusOnes > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-medium text-neutral-700">
              Additional Guest{expectedPlusOnes !== 1 ? "s" : ""} ({expectedPlusOnes})
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            Please provide the name{expectedPlusOnes !== 1 ? "s" : ""} of your additional guest{expectedPlusOnes !== 1 ? "s" : ""}.
          </p>
          
          {plusOnes.map((plusOne, index) => (
            <div key={index} className="space-y-2 bg-white rounded-md p-3 border border-neutral-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Guest {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removePlusOne(index)}
                  className="text-neutral-400 hover:text-red-500 transition-colors"
                  title="Remove guest"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                label="Name"
                placeholder="Enter guest name"
                value={plusOne.name}
                onChange={(e) => updatePlusOne(index, "name", e.target.value)}
                required
                className="text-sm"
              />
              <Input
                label="Email (optional)"
                type="email"
                placeholder="guest@email.com"
                value={plusOne.email || ""}
                onChange={(e) => updatePlusOne(index, "email", e.target.value)}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      <Button
        type="submit"
        loading={submitting}
        className="w-full"
        style={{
          backgroundColor: primaryColor,
          borderRadius: buttonStyle === "pill" ? "9999px" : buttonStyle === "square" ? "0px" : "8px",
        }}
      >
        Submit RSVP
      </Button>
    </form>
  );
}
