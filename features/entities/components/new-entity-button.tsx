"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PillButton } from "@/components/brand/pill-button";
import type { EntityLabels } from "@/lib/entities/labels";
import { EntityDialog } from "./entity-dialog";

export function NewEntityButton({ labels }: { labels: EntityLabels }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PillButton type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {labels.newAction}
      </PillButton>
      <EntityDialog open={open} onOpenChange={setOpen} labels={labels} />
    </>
  );
}
