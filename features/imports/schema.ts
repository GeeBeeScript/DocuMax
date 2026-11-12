import { z } from "zod";
import { IMPORT_FIELDS } from "@/lib/import/fields";

const fieldKeys = IMPORT_FIELDS.map((f) => f.key) as [string, ...string[]];

export const CreateImportSchema = z.object({
  /** `{org_id}/imports/{uuid}.csv`, uploaded by the browser first. */
  storagePath: z.string().regex(/^[0-9a-f-]{36}\/imports\/[0-9a-f-]{36}\.csv$/i),
  fileName: z.string().trim().min(1).max(200),
});

export const StartImportSchema = z.object({
  importId: z.uuid(),
  mapping: z.record(z.enum(fieldKeys), z.string().max(200).nullable()),
  approve: z.boolean().default(false),
});
