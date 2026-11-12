"use client";

import { useState, useTransition } from "react";
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
import { organizationCopy } from "@/content/app";
import { deleteOrganization } from "../actions";

const copy = organizationCopy.danger;

/** Owners: delete the organization after typing its exact name (the action redirects away on success). */
export function DeleteOrganization({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = name.trim() === orgName.trim();

  return (
    <section
      aria-labelledby="danger-heading"
      className="flex max-w-xl flex-col gap-3 rounded-2xl border border-danger/40 bg-paper p-6"
    >
      <h2 id="danger-heading" className="font-heading text-lg font-bold text-danger">
        {copy.title}
      </h2>
      <p className="text-sm text-ink-soft">{copy.description}</p>
      <PillButton
        variant="outline"
        size="sm"
        className="self-start border-danger text-danger"
        onClick={() => setOpen(true)}
      >
        {copy.button}
      </PillButton>
      <Dialog open={open} onOpenChange={(o) => (setOpen(o), setName(""), setError(null))}>
        <DialogContent className="bg-paper p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">{copy.dialogTitle}</DialogTitle>
            <DialogDescription>{copy.dialogBody(orgName)}</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await deleteOrganization({ confirmName: name });
                if (result && !result.ok) setError(result.error);
              });
            }}
          >
            {error && <FormAlert tone="danger">{error}</FormAlert>}
            <TextField
              id="delete-org-name"
              label={copy.label}
              value={name}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
            <DialogFooter className="gap-2 border-0 bg-transparent p-0">
              <PillButton variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                {copy.cancel}
              </PillButton>
              <PillButton
                type="submit"
                size="sm"
                disabled={!matches || pending}
                className="bg-danger hover:bg-danger/90"
              >
                {copy.confirm}
              </PillButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
