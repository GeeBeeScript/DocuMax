"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { reviewSettingsCopy as copy } from "@/content/app";
import { updateReviewSettings } from "../actions";

/** Owners/admins: when documents need a person (confidence threshold) and whether clean ones are auto-approved. */
export function ReviewSettingsForm({
  threshold,
  autoApprove: initialAutoApprove,
}: {
  threshold: number;
  autoApprove: boolean;
}) {
  const [percent, setPercent] = useState(String(Math.round(threshold * 100)));
  const [autoApprove, setAutoApprove] = useState(initialAutoApprove);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(percent);
    if (!/^\d+$/.test(percent.trim()) || value < 50 || value > 100) {
      setFieldError(copy.threshold.invalid);
      return;
    }
    setFieldError(undefined);
    startTransition(async () => {
      const result = await updateReviewSettings({ thresholdPercent: value, autoApprove });
      if (result.ok) {
        setError(null);
        toast.success(copy.saved);
      } else setError(result.error);
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-lg flex-col gap-6 rounded-2xl border border-gray-200 bg-paper p-6"
    >
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <TextField
        id="review-threshold"
        label={copy.threshold.label}
        hint={copy.threshold.hint}
        error={fieldError}
        inputMode="numeric"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        className="max-w-48"
      />
      <div className="flex items-start gap-3">
        <Switch
          id="review-auto-approve"
          checked={autoApprove}
          onCheckedChange={setAutoApprove}
          aria-describedby="review-auto-approve-hint"
          className="mt-0.5"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="review-auto-approve">{copy.autoApprove.label}</Label>
          <p id="review-auto-approve-hint" className="text-xs text-muted-foreground">
            {copy.autoApprove.hint}
          </p>
        </div>
      </div>
      <PillButton type="submit" size="sm" className="self-start" disabled={pending}>
        {copy.save}
      </PillButton>
    </form>
  );
}
