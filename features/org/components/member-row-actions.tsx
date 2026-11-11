"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/app/select-field";
import { PillButton } from "@/components/brand/pill-button";
import { membersCopy, roleMeta } from "@/content/app";
import type { OrgRole } from "@/lib/auth/roles";
import { changeMemberRole, removeMember } from "../actions";
import { roleOptions } from "./role-options";

/** Role select + remove/leave for one member row. Only rendered where the viewer may act. */
export function MemberRowActions({
  membershipId,
  name,
  role,
  assignable,
  canRemove,
  isSelf,
}: {
  membershipId: string;
  name: string;
  role: OrgRole;
  assignable: readonly OrgRole[];
  canRemove: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { actions } = membersCopy;
  // The current role must stay selectable even if the actor couldn't assign it (e.g. admin viewing an owner).
  const options = assignable.includes(role) ? assignable : [role, ...assignable];
  const canChangeRole = assignable.length > 0 && assignable.includes(role);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });

  return (
    <div className="flex items-center justify-end gap-2">
      {canChangeRole ? (
        <SelectField
          id={`role-${membershipId}`}
          label={`${actions.changeRole} for ${name}`}
          hideLabel
          options={roleOptions(options)}
          defaultValue={role}
          disabled={pending}
          className="w-36"
          onChange={(e) =>
            run(() => changeMemberRole({ membershipId, role: e.target.value }), actions.roleChanged)
          }
        />
      ) : (
        <span className="text-sm text-muted-foreground">{roleMeta[role].label}</span>
      )}
      {canRemove && (
        <PillButton
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={isSelf ? actions.leave : `${actions.remove} ${name}`}
          onClick={() => run(() => removeMember({ membershipId }), actions.removed)}
        >
          {isSelf ? actions.leave : actions.remove}
        </PillButton>
      )}
    </div>
  );
}
