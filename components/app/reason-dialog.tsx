"use client";

import { useId, useState } from "react";
import { FormAlert } from "@/components/app/form-alert";
import { PillButton } from "@/components/brand/pill-button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ReasonDialogLabels {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  required: string;
  cancel: string;
  confirm: string;
}

/**
 * Asks for a required reason before a consequential action (reject, approve with errors). Controlled: the caller
 * owns `open`; `onConfirm` receives the trimmed reason.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  labels,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: ReasonDialogLabels;
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return setMissing(true);
    onConfirm(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          setMissing(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-paper p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error && <FormAlert tone="danger">{error}</FormAlert>}
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{labels.label}</Label>
            <textarea
              id={id}
              autoFocus
              rows={3}
              maxLength={1000}
              value={reason}
              placeholder={labels.placeholder}
              aria-invalid={missing || undefined}
              aria-describedby={missing ? `${id}-error` : undefined}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setMissing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
              }}
              className="w-full rounded-lg border border-input bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-danger"
            />
            {missing && (
              <p id={`${id}-error`} className="text-sm text-danger">
                {labels.required}
              </p>
            )}
          </div>
          <DialogFooter className="mt-2 gap-2 border-0 bg-transparent p-0">
            <PillButton variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              {labels.cancel}
            </PillButton>
            <PillButton type="submit" size="sm" disabled={pending}>
              {labels.confirm}
            </PillButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
