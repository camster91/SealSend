"use client";

import { useForm, useWatch } from "react-hook-form";
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
    control,
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

  const phoneValue = useWatch({ control, name: "phone" });
  const emailValue = useWatch({ control, name: "email" });
  const notesValue = useWatch({ control, name: "notes" });

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
            placeholder="+1 416 555 0123"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />
          {phoneValue && (
            <p className="mt-1 text-xs text-gray-400">
              Include the country calling code for international delivery.
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
          {notesValue && (
            <p className="mt-1 text-xs text-gray-400">
              {notesValue.length}/500 characters
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
