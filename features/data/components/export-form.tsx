import { Download } from "lucide-react";
import { SelectField, type SelectOption } from "@/components/app/select-field";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { dataCopy } from "@/content/app";

const copy = dataCopy.export;

/** Export filters as a plain GET form to the export route (the browser downloads the file; no JavaScript needed). */
export function ExportForm({
  entityOptions,
  entitySingular,
  entityPlural,
}: {
  entityOptions: readonly SelectOption[];
  entitySingular: string;
  entityPlural: string;
}) {
  return (
    <form method="get" action="/app/exports/records" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="export-dataset"
          name="dataset"
          label={copy.dataset}
          options={Object.entries(copy.datasets).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          id="export-status"
          name="status"
          label={copy.status}
          options={Object.entries(copy.statuses).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          id="export-entity"
          name="entity"
          label={copy.entity(entitySingular)}
          options={[{ value: "", label: copy.anyEntity(entityPlural) }, ...entityOptions]}
        />
        <SelectField
          id="export-format"
          name="format"
          label={copy.format}
          options={Object.entries(copy.formats).map(([value, label]) => ({ value, label }))}
        />
        <TextField id="export-from" name="from" type="date" label={copy.from} />
        <TextField id="export-to" name="to" type="date" label={copy.to} />
      </div>
      <p className="text-xs text-muted-foreground">{copy.xlsxNote}</p>
      <PillButton type="submit" size="sm" className="self-start">
        <Download aria-hidden /> {copy.download}
      </PillButton>
    </form>
  );
}
