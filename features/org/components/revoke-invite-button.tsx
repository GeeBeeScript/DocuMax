"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { PillButton } from "@/components/brand/pill-button";
import { membersCopy } from "@/content/app";
import { revokeInvite } from "../actions";

export function RevokeInviteButton({ inviteId, email }: { inviteId: string; email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <PillButton
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`${membersCopy.actions.revoke} invite for ${email}`}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeInvite({ inviteId });
          if (result.ok) toast.success(membersCopy.actions.revoked);
          else toast.error(result.error);
        })
      }
    >
      {membersCopy.actions.revoke}
    </PillButton>
  );
}
