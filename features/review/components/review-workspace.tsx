"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Keyboard } from "lucide-react";
import { ConfidencePill } from "@/components/app/confidence-pill";
import { FormAlert } from "@/components/app/form-alert";
import { IssueBanner } from "@/components/app/issue-banner";
import { Kbd } from "@/components/app/kbd";
import { ReasonDialog } from "@/components/app/reason-dialog";
import { SelectField, type SelectOption } from "@/components/app/select-field";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { documentsCopy, reviewCopy } from "@/content/app";
import type { Database } from "@/lib/supabase/database.types";
import { validateRecord, type ValidationContext, type ValidationIssue } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { reviewRecord } from "../actions";
import {
  changedFields,
  fieldInputId,
  linesChanged,
  liveRecord,
  parseDraft,
  toDraft,
  type Draft,
  type DraftField,
} from "../draft";
import { useReviewShortcuts } from "../hooks/use-review-shortcuts";
import { LineItemsEditor } from "./line-items-editor";

type RecordRow = Database["public"]["Tables"]["records"]["Row"];
type LineItemRow = Database["public"]["Tables"]["line_items"]["Row"];

export interface ReviewNav {
  queueHref: string;
  prevHref: string | null;
  nextHref: string | null;
  position: number | null;
  queueSize: number;
}

const copy = reviewCopy.item;
const f = documentsCopy.record.fields;
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

type FieldKind = "text" | "date" | "money" | "number" | "currency" | "select";
interface FieldSpec {
  key: DraftField;
  label: string;
  kind: FieldKind;
  /** Key in field_confidence (entity_id → entity). */
  confidenceKey: string;
  options?: readonly SelectOption[];
  wide?: boolean;
}

const optionsOf = (labels: Record<string, string>): SelectOption[] => [
  { value: "", label: "—" },
  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
];

/**
 * The review screen's interactive half: preview slot | field form with live re-validation, line-item editor and
 * decisions. Re-validation runs lib/validation in the browser with the server-provided context; the server action
 * re-validates before saving, so its result is the one stored. Keyboard: see reviewCopy.item.shortcuts.
 */
export function ReviewWorkspace({
  record,
  lineItems,
  context,
  entityOptions,
  entitySingular,
  canReview,
  approverName,
  nav,
  preview,
  split,
  history,
}: {
  record: RecordRow;
  lineItems: LineItemRow[];
  context: ValidationContext;
  entityOptions: readonly SelectOption[];
  entitySingular: string;
  canReview: boolean;
  approverName: string | null;
  nav: ReviewNav;
  preview: ReactNode;
  /** Allocation editor (its own form, outside the review form). */
  split?: ReactNode;
  history: ReactNode;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(record, lineItems));
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"reject" | "approve" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const decided = record.status !== "needs_review";
  const editable = canReview && !decided;

  const parsed = useMemo(() => parseDraft(draft), [draft]);
  const changed = useMemo(() => changedFields(record, parsed.fields), [record, parsed]);
  const linesDirty = useMemo(() => linesChanged(lineItems, parsed.lines), [lineItems, parsed]);
  const issues: ValidationIssue[] = useMemo(
    () => validateRecord(liveRecord(record, parsed, changed), context),
    [record, parsed, changed, context],
  );
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const changeCount = Object.keys(changed).length + (linesDirty ? 1 : 0);
  const parseErrors = Object.keys(parsed.errors);
  const flagged = useMemo(
    () => new Set(issues.map((i) => i.field).filter((x): x is string => !!x)),
    [issues],
  );
  const confidence = (record.field_confidence ?? {}) as Record<string, number>;

  const fields: FieldSpec[] = [
    { key: "supplier_name", label: f.supplier, kind: "text", confidenceKey: "supplier_name", wide: true },
    {
      key: "document_type",
      label: f.documentType,
      kind: "select",
      confidenceKey: "document_type",
      options: optionsOf(documentsCopy.record.documentTypes),
    },
    { key: "invoice_number", label: f.invoiceNumber, kind: "text", confidenceKey: "invoice_number" },
    { key: "issue_date", label: f.issueDate, kind: "date", confidenceKey: "issue_date" },
    { key: "due_date", label: f.dueDate, kind: "date", confidenceKey: "due_date" },
    { key: "currency", label: f.currency, kind: "currency", confidenceKey: "currency" },
    { key: "supplier_tax_id", label: f.taxId, kind: "text", confidenceKey: "supplier_tax_id" },
    { key: "subtotal_cents", label: f.subtotal, kind: "money", confidenceKey: "subtotal_cents" },
    { key: "tax_cents", label: f.tax, kind: "money", confidenceKey: "tax_cents" },
    { key: "tax_rate", label: `${f.tax} %`, kind: "number", confidenceKey: "tax_rate" },
    { key: "total_cents", label: f.total, kind: "money", confidenceKey: "total_cents" },
    {
      key: "category",
      label: f.category,
      kind: "select",
      confidenceKey: "category",
      options: optionsOf(documentsCopy.record.categories),
    },
    {
      key: "entity_id",
      label: f.entity(entitySingular),
      kind: "select",
      confidenceKey: "entity",
      options: [{ value: "", label: copy.noEntity(entitySingular) }, ...entityOptions],
    },
  ];

  const focusField = (field: string | null | undefined) => {
    const el = document.getElementById(fieldInputId(field ?? "supplier_name"));
    el?.focus();
    el?.scrollIntoView?.({ block: "center" });
  };

  const goNext = () => {
    if (nav.nextHref) router.push(nav.nextHref);
    else {
      toast.success(copy.toasts.queueDone);
      router.push(nav.queueHref);
    }
  };

  const submit = (action: "correct" | "approve" | "reject" | "reopen", reason?: string) => {
    if (action !== "reopen" && parseErrors.length) {
      toast.error(copy.actions.fixErrors);
      focusField(parseErrors[0]);
      return;
    }
    startTransition(async () => {
      const result = await reviewRecord({
        recordId: record.id,
        action,
        ...(action !== "reopen" && changeCount
          ? { fields: changed, lines: linesDirty ? parsed.lines : undefined }
          : {}),
        reason,
      });
      if (!result.ok) {
        // The server found errors the browser couldn't (e.g. a duplicate) — ask for a reason instead.
        if (action === "approve" && !reason && /needs a reason/i.test(result.error)) {
          setDialog("approve");
          return;
        }
        if (dialog) setDialogError(result.error);
        else toast.error(result.error);
        return;
      }
      setDialog(null);
      setDialogError(null);
      if (action === "approve" || action === "reject") {
        toast.success(action === "approve" ? copy.toasts.approved : copy.toasts.rejected);
        goNext();
      } else {
        toast.success(action === "correct" ? copy.toasts.saved : copy.toasts.reopened);
        router.refresh();
      }
    });
  };

  const approve = () => {
    if (!editable || pending) return;
    if (errorCount > 0) setDialog("approve");
    else submit("approve");
  };
  const reject = () => editable && !pending && setDialog("reject");
  const save = () => editable && !pending && changeCount > 0 && submit("correct");

  useReviewShortcuts({
    approve,
    reject,
    save,
    edit: () => editable && focusField(issues.find((i) => i.field)?.field),
    next: () => nav.nextHref && router.push(nav.nextHref),
    prev: () => nav.prevHref && router.push(nav.prevHref),
    help: () => setShowHelp((v) => !v),
  });

  const setField = (key: DraftField, value: string) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));

  const issueAction = (issue: ValidationIssue) => {
    if (issue.code === "duplicate" && typeof issue.details?.recordId === "string")
      return (
        <PillButton href={`/app/review/${issue.details.recordId}`} variant="ghost" size="sm" target="_blank">
          {copy.viewDuplicate}
        </PillButton>
      );
    const docIds = issue.details?.documentIds;
    if (issue.code === "duplicate_file" && Array.isArray(docIds) && typeof docIds[0] === "string")
      return (
        <PillButton href={`/app/documents/${docIds[0]}`} variant="ghost" size="sm" target="_blank">
          {copy.viewDuplicate}
        </PillButton>
      );
    if (issue.field && editable)
      return (
        <PillButton variant="ghost" size="sm" onClick={() => focusField(issue.field)}>
          {copy.fix}
        </PillButton>
      );
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Queue navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <PillButton href={nav.queueHref} variant="ghost" size="sm">
          <ArrowLeft aria-hidden /> {copy.back}
        </PillButton>
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {nav.position ? copy.position(nav.position, nav.queueSize) : copy.notInQueue}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <PillButton
            variant="ghost"
            size="sm"
            aria-label={copy.shortcuts.toggle}
            aria-expanded={showHelp}
            onClick={() => setShowHelp((v) => !v)}
          >
            <Keyboard aria-hidden />
          </PillButton>
          {nav.prevHref ? (
            <PillButton href={nav.prevHref} variant="outline" size="sm" aria-label={copy.prev}>
              <ChevronLeft aria-hidden />
            </PillButton>
          ) : (
            <PillButton variant="outline" size="sm" aria-label={copy.prev} disabled>
              <ChevronLeft aria-hidden />
            </PillButton>
          )}
          {nav.nextHref ? (
            <PillButton href={nav.nextHref} variant="outline" size="sm" aria-label={copy.next}>
              <ChevronRight aria-hidden />
            </PillButton>
          ) : (
            <PillButton variant="outline" size="sm" aria-label={copy.next} disabled>
              <ChevronRight aria-hidden />
            </PillButton>
          )}
        </div>
      </div>

      {showHelp && (
        <section
          aria-label={copy.shortcuts.title}
          className="rounded-2xl border border-gray-200 bg-paper p-4 text-sm"
        >
          <h2 className="mb-2 font-heading font-semibold">{copy.shortcuts.title}</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {copy.shortcuts.items.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-label={copy.document}
          className="max-h-[60dvh] min-w-0 overflow-auto rounded-2xl border border-gray-200 bg-paper p-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-auto"
        >
          {preview}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {/* Status and issues */}
            <div className="flex flex-col gap-2" aria-live="polite">
              {!canReview && <FormAlert tone="info">{copy.readOnly}</FormAlert>}
              {decided ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
                  <p className="flex-1">
                    {record.status === "approved"
                      ? copy.decided.approved(
                          approverName,
                          dateTime.format(new Date(record.approved_at ?? record.updated_at)),
                        )
                      : copy.decided.rejected(dateTime.format(new Date(record.updated_at)))}{" "}
                    {canReview && copy.decided.reopenHint}
                  </p>
                  {canReview && (
                    <PillButton
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => submit("reopen")}
                    >
                      {copy.actions.reopen}
                    </PillButton>
                  )}
                </div>
              ) : issues.length === 0 ? (
                <FormAlert tone="success">{copy.clean}</FormAlert>
              ) : (
                <>
                  <p className="text-sm font-semibold text-ink">
                    {copy.issueCount(errorCount, issues.length - errorCount)}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {groupIssues(issues).map((group) => (
                      <li key={group[0]!.code}>
                        <IssueBanner
                          severity={group[0]!.severity}
                          title={reviewCopy.issues[group[0]!.code]}
                          message={
                            group.length === 1 ? (
                              group[0]!.message
                            ) : (
                              <ul className="list-disc pl-4">
                                {group.map((issue, i) => (
                                  <li key={`${issue.field ?? ""}-${i}`}>{issue.message}</li>
                                ))}
                              </ul>
                            )
                          }
                          actions={issueAction(group[0]!)}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Fields */}
            <section aria-labelledby="review-fields" className="flex flex-col gap-4">
              <h2 id="review-fields" className="font-heading text-lg font-bold">
                {copy.sections.fields}
              </h2>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                {fields.map((spec) => (
                  <FieldInput
                    key={spec.key}
                    spec={spec}
                    value={draft.fields[spec.key]}
                    onChange={(v) => setField(spec.key, v)}
                    disabled={!editable}
                    edited={spec.key in changed}
                    confidence={confidence[spec.confidenceKey]}
                    threshold={context.threshold}
                    error={
                      parsed.errors[spec.key] ??
                      issues.find(
                        (i) =>
                          i.severity === "error" &&
                          (i.field === spec.key || (spec.key === "entity_id" && i.field === "entity")),
                      )?.message
                    }
                  />
                ))}
              </div>
            </section>

            {/* Line items */}
            <section aria-labelledby="review-lines" className="flex flex-col gap-3">
              <h2 id="review-lines" className="font-heading text-lg font-bold">
                {copy.sections.lines}
              </h2>
              <LineItemsEditor
                lines={draft.lines}
                onChange={(lines) => setDraft((d) => ({ ...d, lines }))}
                errors={parsed.errors}
                flagged={flagged}
                disabled={!editable}
              />
            </section>

            {/* Decisions */}
            {editable && (
              <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-gray-200 bg-paper/95 px-3 py-3 shadow-sm backdrop-blur sm:px-4">
                <span
                  className="mr-auto basis-full text-sm text-muted-foreground empty:hidden sm:basis-auto"
                  aria-live="polite"
                >
                  {changeCount > 0 ? copy.actions.unsaved(changeCount) : null}
                </span>
                <PillButton type="submit" variant="outline" size="sm" disabled={pending || changeCount === 0}>
                  {copy.actions.save}
                </PillButton>
                <PillButton variant="ghost" size="sm" disabled={pending} onClick={reject}>
                  {copy.actions.reject} <Kbd className="hidden sm:inline-flex">R</Kbd>
                </PillButton>
                <PillButton size="sm" disabled={pending} onClick={approve}>
                  {copy.actions.approve}{" "}
                  <Kbd className="hidden border-ink-soft bg-ink-soft text-paper sm:inline-flex">A</Kbd>
                </PillButton>
              </div>
            )}
          </form>

          {split}

          <section aria-labelledby="review-history" className="flex flex-col gap-3">
            <h2 id="review-history" className="font-heading text-lg font-bold">
              {copy.sections.history}
            </h2>
            {history}
          </section>
        </div>
      </div>

      <ReasonDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setDialogError(null);
          }
        }}
        pending={pending}
        error={dialogError}
        labels={{
          title: dialog === "approve" ? copy.reason.approveTitle : copy.reason.rejectTitle,
          description: dialog === "approve" ? copy.reason.approveBody : copy.reason.rejectBody,
          label: copy.reason.label,
          placeholder: copy.reason.placeholder,
          required: copy.reason.required,
          cancel: copy.reason.cancel,
          confirm: dialog === "approve" ? copy.reason.approve : copy.reason.reject,
        }}
        onConfirm={(reason) => submit(dialog === "approve" ? "approve" : "reject", reason)}
      />
    </div>
  );
}

function FieldInput({
  spec,
  value,
  onChange,
  disabled,
  edited,
  confidence,
  threshold,
  error,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  edited: boolean;
  confidence: number | undefined;
  threshold: number;
  error?: string;
}) {
  const id = fieldInputId(spec.key);
  const badge = edited ? (
    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
      {copy.edited}
    </span>
  ) : confidence != null ? (
    <ConfidencePill score={confidence} threshold={threshold} />
  ) : null;

  return (
    <div className={cn("relative flex flex-col", spec.wide && "sm:col-span-2")}>
      <div className="pointer-events-none absolute -top-0.5 right-0">{badge}</div>
      {spec.kind === "select" ? (
        <SelectField
          id={id}
          label={spec.label}
          options={spec.options ?? []}
          value={value}
          disabled={disabled}
          error={error}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <TextField
          id={id}
          label={spec.label}
          type={spec.kind === "date" ? "date" : "text"}
          inputMode={spec.kind === "money" || spec.kind === "number" ? "decimal" : undefined}
          maxLength={spec.kind === "currency" ? 3 : undefined}
          autoComplete="off"
          value={value}
          disabled={disabled}
          error={error}
          placeholder={spec.kind === "money" ? copy.amountHint : undefined}
          className={cn(spec.kind === "money" && "[&_input]:text-right [&_input]:tabular-nums")}
          onChange={(e) => onChange(spec.kind === "currency" ? e.target.value.toUpperCase() : e.target.value)}
        />
      )}
    </div>
  );
}

/** One banner per issue code (four low-confidence fields read better as one list). Order is kept. */
function groupIssues(issues: readonly ValidationIssue[]): ValidationIssue[][] {
  const groups = new Map<string, ValidationIssue[]>();
  for (const issue of issues) groups.set(issue.code, [...(groups.get(issue.code) ?? []), issue]);
  return [...groups.values()];
}
