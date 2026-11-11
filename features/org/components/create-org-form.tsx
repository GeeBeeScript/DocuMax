"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, HardHat } from "lucide-react";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { onboardingCopy } from "@/content/app";
import { ENTITY_KINDS } from "@/lib/entities/labels";
import { cn } from "@/lib/utils";
import { createOrganization } from "../actions";
import { CreateOrgSchema, type CreateOrgInput } from "../schema";

const icons = { property: Building2, job: HardHat } as const;

export function CreateOrgForm() {
  const copy = onboardingCopy.org;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreateOrgInput>({
    resolver: zodResolver(CreateOrgSchema),
    defaultValues: { name: "" },
  });
  const { errors } = form.formState;
  const selected = form.watch("entityKind");

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createOrganization(values);
      if (result && !result.ok) setError(result.error); // success redirects
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <TextField
        id="org-name"
        label={copy.nameLabel}
        placeholder={copy.namePlaceholder}
        size="lg"
        autoComplete="organization"
        error={errors.name?.message}
        {...form.register("name")}
      />
      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.entityKind ? "mode-error" : undefined}
      >
        <legend className="mb-1 text-sm font-medium">{copy.modeLabel}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENTITY_KINDS.map((kind) => {
            const Icon = icons[kind];
            return (
              <label
                key={kind}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-2xl border border-gray-200 bg-paper p-4 transition-colors hover:border-ink has-focus-visible:ring-3 has-focus-visible:ring-ink/30",
                  selected === kind && "border-ink bg-yellow-soft",
                )}
              >
                <input type="radio" value={kind} className="sr-only" {...form.register("entityKind")} />
                <Icon className="size-6" aria-hidden />
                <span className="font-heading font-bold">{copy.modes[kind].title}</span>
                <span className="text-sm text-muted-foreground">{copy.modes[kind].description}</span>
              </label>
            );
          })}
        </div>
        {errors.entityKind && (
          <p id="mode-error" className="text-sm text-danger">
            {errors.entityKind.message}
          </p>
        )}
      </fieldset>
      <PillButton type="submit" size="lg" disabled={pending} className="w-full">
        {copy.submit}
      </PillButton>
    </form>
  );
}
