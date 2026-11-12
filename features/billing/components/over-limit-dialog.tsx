"use client";

import { PillButton } from "@/components/brand/pill-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { billingCopy } from "@/content/app";

const copy = billingCopy.overLimit;

/**
 * Shown when an upload would go past this month's document cap: say so, offer to upload what still fits, and point
 * owners to the plans (others are told to ask an owner).
 */
export function OverLimitDialog({
  open,
  onOpenChange,
  planName,
  cap,
  remaining,
  canManageBilling,
  onUploadSome,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  cap: number;
  /** Documents that still fit this month (0 = none). */
  remaining: number;
  canManageBilling: boolean;
  onUploadSome?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-paper p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">{copy.title}</DialogTitle>
          <DialogDescription>
            {remaining > 0 ? copy.partial(remaining) : copy.body(planName, cap)}
          </DialogDescription>
        </DialogHeader>
        {!canManageBilling && <p className="text-sm text-muted-foreground">{copy.askOwner}</p>}
        <DialogFooter className="mt-2 gap-2 border-0 bg-transparent p-0">
          <PillButton variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {copy.close}
          </PillButton>
          {remaining > 0 && onUploadSome && (
            <PillButton variant="outline" size="sm" onClick={onUploadSome}>
              {copy.uploadSome(remaining)}
            </PillButton>
          )}
          {canManageBilling && (
            <PillButton href="/app/settings/billing" size="sm">
              {copy.upgrade}
            </PillButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
