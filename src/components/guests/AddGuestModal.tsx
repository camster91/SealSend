"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { guestSchema, type GuestInput } from "@/lib/validations";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import type { Guest } from "@/types/database";
import { useState, useEffect } from "react";

interface AddGuestModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  guest?: Guest | null;
  existingGuests?: Guest[];
  onSuccess: () => void;
}

// Format phone number as user types
function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length === 0) return "";
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
}

export function AddGuestModal({
  open,
  onClose,
  eventId,
  guest,
  existingGuests = [],
  onSuccess,
}: AddGuestModalProps) {
  const isEdit = !!guest;
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: guest
      ? {
          name: guest.name,
          email: guest.email || "",
          phone: guest.phone || "",
          notes: guest.notes || "",
        }
      : {
          name: "",
          email: "",
          phone: "",
          notes: "",
        },
  });

  const phoneValue = watch("phone");
  const emailValue = watch("email");

  // Format phone number as user types
  useEffect(() => {
    if (phoneValue && phoneValue !== guest?.phone) {
      const formatted = formatPhoneNumber(phoneValue);
      if (formatted !== phoneValue) {
        setValue("phone", formatted);
      }
    }
  }, [phoneValue, setValue, guest?.phone]);

  // Check for duplicates
  useEffect(() => {
    if (isEdit || !existingGuests.length) return;

    const email = emailValue?.toLowerCase().trim();
    const phone = phoneValue?.replace(/\D/g, "");

    const duplicate = existingGuests.find((g) => {
      if (email && g.email?.toLowerCase() === email) return true;
      if (phone && g.phone?.replace(/\D/g, "") === phone) return true;
      return false;
    });

    if (duplicate) {
      setDuplicateError(
        `This ${email && phone ? "email or phone" : email ? "email" : "phone"} already exists for "${duplicate.name}"`
      );
    } else {
      setDuplicateError(null);
    }
  }, [emailValue, phoneValue, existingGuests, isEdit]);

  async function onSubmit(data: GuestInput) {
    if (duplicateError && !isEdit) return;

    const url = isEdit
      ? `/api/events/${eventId}/guests/${guest!.id}`
      : `/api/events/${eventId}/guests`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      reset();
      onSuccess();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Guest" : "Add Guest"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="name"
          label="Name *"
          placeholder="Guest name"
          error={errors.name?.message}
          {...register("name")}
        />
        
        <div>
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="guest@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          {emailValue && (
            <p className="mt-1 text-xs text-gray-400">
              {emailValue.length}/254 characters
            </p>
          )}
        </div>

        <div>
          <Input
            id="phone"
            label="Phone Number"
            type="tel"
            placeholder="(555) 000-0000"
            error={errors.phone?.message}
            {...register("phone")}
          />
          {phoneValue && (
            <p className="mt-1 text-xs text-gray-400">
              {phoneValue.replace(/\D/g, "").length}/10 digits
            </p>
          )}
        </div>

        <div>
          <Textarea
            id="notes"
            label="Notes"
            placeholder="Any notes about this guest..."
            error={errors.notes?.message}
            {...register("notes")}
          />
          {watch("notes") && (
            <p className="mt-1 text-xs text-gray-400">
              {watch("notes").length}/500 characters
            </p>
          )}
        </div>

        {duplicateError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            ⚠️ {duplicateError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isSubmitting}
            disabled={!!duplicateError && !isEdit}
          >
            {isEdit ? "Update" : "Add Guest"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
