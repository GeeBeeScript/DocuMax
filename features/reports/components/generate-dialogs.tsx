"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileChartColumn, FileSignature, Files } from "lucide-react";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportsCopy } from "@/content/app";
import { parsePercentBp } from "@/lib/calc/allocate";
import { monthPeriod, periodLabel, type Period } from "@/lib/calc/period";
import { generateQuote, generateStatement, generateStatementBatch, generateSummary } from "../actions";

const copy = reportsCopy.dialogs;
type Result = { ok: true } | { ok: false; error: string };

/** Dialog shell shared by the generate actions: fields, error, Cancel / Generate. */
function GenerateDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  onGenerate: () => Promise<Result> | Result;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onGenerate();
      if (!result.ok) return setError(result.error);
      onOpenChange(false);
      toast.success(copy.queued, {
        action: { label: copy.viewReports, onClick: () => router.push("/app/reports") },
      });
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (setError(null), onOpenChange(next))}>
      <DialogContent className="bg-paper p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error && <FormAlert tone="danger">{error}</FormAlert>}
          {children}
          <DialogFooter className="mt-2 gap-2 border-0 bg-transparent p-0">
            <PillButton variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              {copy.cancel}
            </PillButton>
            <PillButton type="submit" size="sm" disabled={pending}>
              {copy.generate}
            </PillButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const monthInput =
  "h-10 w-full rounded-lg border border-input bg-paper px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** "Statements for all …" (batch) or "Portfolio summary" for a month. */
export function MonthReportButton({
  kind,
  defaultMonth,
  plural,
}: {
  kind: "batch" | "summary";
  /** YYYY-MM */
  defaultMonth: string;
  plural: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const title = kind === "batch" ? copy.batchTitle(plural) : copy.summaryTitle;
  return (
    <>
      <PillButton variant={kind === "batch" ? "primary" : "outline"} size="sm" onClick={() => setOpen(true)}>
        {kind === "batch" ? <Files aria-hidden /> : <FileChartColumn aria-hidden />}
        {kind === "batch" ? reportsCopy.actions.batch(plural) : reportsCopy.actions.summary}
      </PillButton>
      <GenerateDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={kind === "batch" ? copy.batchBody(plural) : copy.summaryBody}
        onGenerate={async () => {
          if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: copy.month };
          const period = monthPeriod(month);
          const result =
            kind === "batch" ? await generateStatementBatch({ period }) : await generateSummary({ period });
          return result.ok ? { ok: true } : result;
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${kind}-month`}>{copy.month}</Label>
          <input
            id={`${kind}-month`}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={monthInput}
          />
        </div>
      </GenerateDialog>
    </>
  );
}

/** Entity page: statement for the shown period; quote (jobs) with markup, tax, validity and notes. */
export function EntityReportActions({
  entityId,
  entityName,
  period,
  quotes,
}: {
  entityId: string;
  entityName: string;
  period: Period;
  quotes: boolean;
}) {
  const [dialog, setDialog] = useState<"statement" | "quote" | null>(null);
  const [from, setFrom] = useState(period.start);
  const [to, setTo] = useState(period.end);
  const [markup, setMarkup] = useState("15");
  const [tax, setTax] = useState("0");
  const [validDays, setValidDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  return (
    <>
      <PillButton size="sm" onClick={() => setDialog("statement")}>
        <FileChartColumn aria-hidden /> {reportsCopy.actions.statement}
      </PillButton>
      {quotes && (
        <PillButton variant="outline" size="sm" onClick={() => setDialog("quote")}>
          <FileSignature aria-hidden /> {reportsCopy.actions.quote}
        </PillButton>
      )}
      <GenerateDialog
        open={dialog === "statement"}
        onOpenChange={(o) => setDialog(o ? "statement" : null)}
        title={copy.statementTitle}
        description={copy.statementBody(entityName, periodLabel(period))}
        onGenerate={async () => {
          const result = await generateStatement({ entityId, period });
          return result.ok ? { ok: true } : result;
        }}
      />
      <GenerateDialog
        open={dialog === "quote"}
        onOpenChange={(o) => setDialog(o ? "quote" : null)}
        title={copy.quoteTitle}
        description={copy.quoteBody}
        onGenerate={async () => {
          const markupBp = parsePercentBp(markup, 100_000);
          const taxRateBp = parsePercentBp(tax);
          const errors: Record<string, string> = {};
          if (markupBp == null) errors.markup = copy.invalidPercent;
          if (taxRateBp == null) errors.tax = copy.invalidPercent;
          setFieldError(errors);
          if (markupBp == null || taxRateBp == null) return { ok: false, error: copy.invalidPercent };
          const result = await generateQuote({
            entityId,
            period: { start: from, end: to },
            markupBp,
            taxRateBp,
            validDays: Number(validDays),
            notes,
          });
          return result.ok ? { ok: true } : result;
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="quote-from"
            type="date"
            label={copy.from}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            id="quote-to"
            type="date"
            label={copy.to}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <TextField
            id="quote-markup"
            label={copy.markup}
            inputMode="decimal"
            value={markup}
            error={fieldError.markup}
            onChange={(e) => setMarkup(e.target.value)}
          />
          <TextField
            id="quote-tax"
            label={copy.tax}
            inputMode="decimal"
            value={tax}
            error={fieldError.tax}
            onChange={(e) => setTax(e.target.value)}
          />
          <TextField
            id="quote-valid"
            label={copy.validDays}
            inputMode="numeric"
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quote-notes">{copy.notes}</Label>
          <textarea
            id="quote-notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-input bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </GenerateDialog>
    </>
  );
}
