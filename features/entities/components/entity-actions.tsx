"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { entitiesCopy } from "@/content/app";
import type { EntityLabels } from "@/lib/entities/labels";
import { setEntityStatus } from "../actions";
import { EntityDialog, type EntityFormValues } from "./entity-dialog";

/** "⋯" menu for one entity: edit, archive / restore. */
export function EntityActions({
  entity,
  archived,
  labels,
}: {
  entity: EntityFormValues & { id: string };
  archived: boolean;
  labels: EntityLabels;
}) {
  const { actions } = entitiesCopy;
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await setEntityStatus({ id: entity.id, status: archived ? "active" : "archived" });
      if (result.ok)
        toast.success(archived ? actions.restored(labels.singular) : actions.archived(labels.singular));
      else toast.error(result.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={actions.menu(entity.name)}
          disabled={pending}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-gray-100 hover:text-ink focus-visible:ring-3 focus-visible:ring-ink/30 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {!archived && <DropdownMenuItem onClick={() => setEditing(true)}>{actions.edit}</DropdownMenuItem>}
          <DropdownMenuItem onClick={toggleArchive}>
            {archived ? actions.restore : actions.archive}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EntityDialog open={editing} onOpenChange={setEditing} labels={labels} entity={entity} />
    </>
  );
}
