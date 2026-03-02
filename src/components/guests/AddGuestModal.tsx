"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { guestSchema, type GuestInput } from "@/lib/validations";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import type { Guest } from "@/types/database";

interface AddGuestModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  guest?: Guest | null;
  onSuccess: () => void;
}

export function AddGuestModal({
  open,
  onClose,
  eventId,
  guest,
  onSuccess,
}: AddGuestModalProps) {
  const isEdit = !!guest;

  const {
    register,
    handleSubmit,
    reset,
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
      : undefined,
  });

  async function onSubmit(data: GuestInput) {
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
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="guest@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          id="phone"
          label="Phone Number"
          type="tel"
          placeholder="+1 (555) 000-0000"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Textarea
          id="notes"
          label="Notes"
          placeholder="Any notes about this guest..."
          error={errors.notes?.message}
          {...register("notes")}
        />
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Update" : "Add Guest"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
