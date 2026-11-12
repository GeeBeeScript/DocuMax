"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { PillButton } from "@/components/brand/pill-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reviewCopy } from "@/content/app";
import { bulkApproveClean } from "../actions";

const copy = reviewCopy.queue.bulk;

/** Approves the listed clean records after a confirmation (the database re-checks that each has no issues). */
export function BulkApproveButton({ recordIds }: { recordIds: readonly string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ids = recordIds.slice(0, 200);
  if (ids.length === 0) return null;

  const confirm = () =>
    startTransition(async () => {
      const result = await bulkApproveClean({ recordIds: ids });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(copy.done(result.data.approved));
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <PillButton size="sm" onClick={() => setOpen(true)}>
        <CheckCheck aria-hidden /> {copy.button(ids.length)}
      </PillButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-paper p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">{copy.confirmTitle}</DialogTitle>
            <DialogDescription>{copy.confirmBody(ids.length)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 border-0 bg-transparent p-0">
            <PillButton variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {copy.cancel}
            </PillButton>
            <PillButton size="sm" onClick={confirm} disabled={pending}>
              {copy.confirm}
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
