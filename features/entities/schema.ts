import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const EntityFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(160),
  code: optionalText(40),
  address: optionalText(300),
  clientName: optionalText(160),
});

export const CreateEntitySchema = EntityFieldsSchema;
export const UpdateEntitySchema = EntityFieldsSchema.extend({ id: z.uuid() });
export const SetEntityStatusSchema = z.object({ id: z.uuid(), status: z.enum(["active", "archived"]) });

export type EntityFieldsInput = z.input<typeof EntityFieldsSchema>;
