"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getClientUser } from "@/lib/auth/client-auth";
import type { RSVPField, PlusOneData, RSVPResponse } from "@/types/database";
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
  inviteToken?: string;
  inviteGuestId?: string;
  inviteGuestName?: string;
  inviteGuestEmail?: string | null;
}

export function RSVPForm({ eventSlug, fields, primaryColor, buttonStyle = "rounded", allowPlusOnes = true, maxGuestsPerRsvp = 10, spotsRemaining = null, inviteToken, inviteGuestId, inviteGuestName, inviteGuestEmail }: RSVPFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [plusOnes, setPlusOnes] = useState<PlusOneData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [availableSpots, setAvailableSpots] = useState(spotsRemaining);
  const [error, setError] = useState<string | null>(null);

  // Calculate current headcount
  const headcount = parseInt(formData["headcount"] || "1", 10) || 1;
  const expectedPlusOnes = Math.max(0, headcount - 1);

  // GET establishes a private edit cookie before the first public submission.
  // Personal invitations authorize reloads by their event-bound token instead.
  useEffect(() => {
    let cancelled = false;
    async function loadResponse() {
      try {
        const res = await fetch(`/api/rsvp/${eventSlug}`, {
          headers: inviteToken ? { "X-Guest-Token": inviteToken } : {}, cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load your response.");
        if (cancelled) return;
        const saved = data.response as RSVPResponse | null;
        const user = !inviteGuestName ? getClientUser() : null;
        const initial: Record<string, string> = {};
        if (saved) {
          for (const [key, value] of Object.entries(saved.response_data || {})) {
            if (typeof value === "string") initial[key] = value;
          }
          for (const field of fields) {
            if (field.field_type === "attendance") initial[field.field_name] = saved.status;
          }
        }
        initial.respondent_name = saved?.respondent_name || inviteGuestName || user?.name || user?.email?.split("@")[0] || "";
        initial.email = saved?.respondent_email || inviteGuestEmail || user?.email || "";
        initial.headcount = String(saved?.headcount ?? 1);
        setFormData(initial);
        setPlusOnes(saved?.plus_ones_data || []);
        setAvailableSpots(data.spots_remaining);
        setSubmitted(Boolean(saved));
        setError(null);
        setLoading(false);
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Unable to load your response. Reload to try again.");
      }
    }
    void loadResponse();
    return () => { cancelled = true; };
  }, [eventSlug, inviteToken, inviteGuestName, inviteGuestEmail, fields, loadAttempt]);

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
        headers: { "Content-Type": "application/json", ...(inviteToken ? { "X-Guest-Token": inviteToken } : {}) },
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
      // A confirmed save stays successful even if the follow-up capacity read fails.
      try {
        const current = await fetch(`/api/rsvp/${eventSlug}`, { headers: inviteToken ? { "X-Guest-Token": inviteToken } : {}, cache: "no-store" });
        if (current.ok) setAvailableSpots((await current.json()).spots_remaining);
      } catch { /* Keep the last known capacity until the next load. */ }
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
        <button
          type="button"
          onClick={() => { setSubmitted(false); setError(null); }}
          className="mt-4 text-sm font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
        >
          Update your response
        </button>
      </div>
    );
  }

  return (
    <form aria-label="RSVP" onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">RSVP</h2>
        {availableSpots !== null && (
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            availableSpots > 10
              ? "bg-green-100 text-green-700"
              : availableSpots > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          )}>
            {availableSpots > 0 ? `${availableSpots} spots left` : "Event full"}
          </span>
        )}
      </div>

      {inviteGuestName && (
        <div className="rounded-lg bg-brand-50 border border-brand-100 px-4 py-2.5">
          <p className="text-sm text-brand-700">
            Welcome, <strong>{inviteGuestName}</strong>! Your details have been pre-filled.
          </p>
        </div>
      )}

      {/* Always show name field */}
      <Input
        id="rsvp-name"
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
                id={`rsvp-${field.id}`}
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
                    availableSpots !== null ? Math.max(1, availableSpots) : maxGuestsPerRsvp
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
                  id={`rsvp-${field.id}`}
                  label={`${field.field_label}${field.is_required ? " *" : ""}`}
                  type="number"
                  min="1"
                  max={String(effectiveMax)}
                  placeholder={field.placeholder || "1"}
                  value={formData[field.field_name] || ""}
                  onChange={(e) => updateField(field.field_name, e.target.value)}
                  required={field.is_required}
                />
                {isHeadcount && availableSpots !== null && (
                  <p className="mt-1 text-xs text-gray-500">
                    {availableSpots} spot{availableSpots !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>
            );
          }
          case "select":
            return (
              <Select
                key={field.id}
                id={`rsvp-${field.id}`}
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
                id={`rsvp-${field.id}`}
                label={`${field.field_label}${field.is_required ? " *" : ""}`}
                placeholder={field.placeholder || ""}
                value={formData[field.field_name] || ""}
                onChange={(e) => updateField(field.field_name, e.target.value)}
                required={field.is_required}
              />
            ) : (
              <Input
                key={field.id}
                id={`rsvp-${field.id}`}
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
                  aria-label={`Remove guest ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                id={`rsvp-plus-one-${index}-name`}
                label="Name"
                placeholder="Enter guest name"
                value={plusOne.name}
                onChange={(e) => updatePlusOne(index, "name", e.target.value)}
                required
                className="text-sm"
              />
              <Input
                id={`rsvp-plus-one-${index}-email`}
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
          {loading && <button type="button" onClick={() => { setError(null); setLoadAttempt((value) => value + 1); }} className="ml-2 underline">Retry loading response</button>}
        </div>
      )}

      <Button
        type="submit"
        loading={submitting}
        disabled={loading}
        className="w-full"
        style={{
          backgroundColor: primaryColor,
          borderRadius: buttonStyle === "pill" ? "9999px" : buttonStyle === "square" ? "0px" : "8px",
        }}
      >
        {loading ? "Loading your response…" : "Submit RSVP"}
      </Button>
    </form>
  );
}
