"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/app/form-alert";
import { SelectField } from "@/components/app/select-field";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { membersCopy } from "@/content/app";
import { INVITABLE_ROLES } from "@/lib/auth/roles";
import { inviteMember } from "../actions";
import { InviteMemberSchema, type InviteMemberInput } from "../schema";
import { roleOptions } from "./role-options";

/** Creates an invite and shows the one-time link to share (email delivery is not wired yet). */
export function InviteForm() {
  const copy = membersCopy.invite;
  const [pending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: { email: "", role: "member" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await inviteMember(values);
      if (result.ok) {
        setInviteUrl(result.data.inviteUrl);
        form.reset({ email: "", role: values.role });
      } else {
        setError(result.error);
      }
    });
  });

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success(copy.copied);
    } catch {
      // Clipboard can be blocked; the link stays visible and selectable.
    }
  }

  return (
    <section
      aria-labelledby="invite-heading"
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-paper p-5"
    >
      <h2 id="invite-heading" className="text-lg font-bold">
        {copy.heading}
      </h2>
      <form onSubmit={onSubmit} noValidate className="grid items-start gap-3 sm:grid-cols-[1fr_10rem_auto]">
        <TextField
          id="invite-email"
          label={copy.emailLabel}
          type="email"
          autoComplete="off"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <SelectField
          id="invite-role"
          label={copy.roleLabel}
          options={roleOptions(INVITABLE_ROLES)}
          {...form.register("role")}
        />
        <PillButton type="submit" size="sm" disabled={pending} className="h-10 sm:mt-6">
          {copy.submit}
        </PillButton>
      </form>
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      {inviteUrl && (
        <div className="flex flex-col gap-2">
          <FormAlert tone="success">{copy.created}</FormAlert>
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Invite link"
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-gray-50 px-3 font-mono text-xs"
            />
            <PillButton type="button" size="sm" variant="outline" className="h-10" onClick={copyLink}>
              <Copy aria-hidden /> {copy.copy}
            </PillButton>
          </div>
        </div>
      )}
    </section>
  );
}
