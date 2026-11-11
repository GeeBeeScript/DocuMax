"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/app/form-alert";
import { PillButton } from "@/components/brand/pill-button";
import { inviteCopy } from "@/content/app";
import { acceptInvite } from "../actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {error && <FormAlert tone="danger">{error}</FormAlert>}
      <PillButton
        type="button"
        size="lg"
        disabled={pending}
        className="w-full"
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvite({ token });
            if (result && !result.ok) setError(result.error); // success redirects
          })
        }
      >
        {inviteCopy.accept}
      </PillButton>
    </div>
  );
}
