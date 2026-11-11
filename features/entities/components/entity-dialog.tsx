"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { entitiesCopy } from "@/content/app";
import type { EntityLabels } from "@/lib/entities/labels";
import { createEntity, updateEntity } from "../actions";
import { EntityFieldsSchema, type EntityFieldsInput } from "../schema";

export interface EntityFormValues {
  id?: string;
  name: string;
  code: string | null;
  address: string | null;
  clientName: string | null;
}

/** Create / edit dialog for a property or job. Controlled: the caller owns `open`. */
export function EntityDialog({
  open,
  onOpenChange,
  labels,
  entity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: EntityLabels;
  entity?: EntityFormValues;
}) {
  const copy = entitiesCopy.dialog;
  const editing = Boolean(entity?.id);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EntityFieldsInput>({
    resolver: zodResolver(EntityFieldsSchema),
    values: {
      name: entity?.name ?? "",
      code: entity?.code ?? "",
      address: entity?.address ?? "",
      clientName: entity?.clientName ?? "",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = editing ? await updateEntity({ ...values, id: entity!.id }) : await createEntity(values);
      if (result.ok) {
        toast.success(editing ? entitiesCopy.actions.saved : entitiesCopy.actions.created(labels.singular));
        onOpenChange(false);
        form.reset();
      } else {
        setError(result.error);
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof EntityFieldsInput, { message: messages[0] });
        }
      }
    });
  });

  const optional = (label: string) => `${label} (${copy.optional.toLowerCase()})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-paper p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">
            {editing ? copy.editTitle(labels.singular) : copy.createTitle(labels.singular)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {editing ? copy.editTitle(labels.singular) : copy.createTitle(labels.singular)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && <FormAlert tone="danger">{error}</FormAlert>}
          <TextField
            id="entity-name"
            label={labels.fields.name}
            placeholder={labels.examples.name}
            error={errors.name?.message}
            {...form.register("name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="entity-code"
              label={optional(labels.fields.code)}
              placeholder={labels.examples.code}
              error={errors.code?.message}
              {...form.register("code")}
            />
            <TextField
              id="entity-client"
              label={optional(labels.fields.clientName)}
              placeholder={labels.examples.clientName}
              error={errors.clientName?.message}
              {...form.register("clientName")}
            />
          </div>
          <TextField
            id="entity-address"
            label={optional(labels.fields.address)}
            placeholder={labels.examples.address}
            error={errors.address?.message}
            {...form.register("address")}
          />
          <DialogFooter className="mt-2 gap-2 border-0 bg-transparent p-0">
            <PillButton type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </PillButton>
            <PillButton type="submit" size="sm" disabled={pending}>
              {copy.save}
            </PillButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
