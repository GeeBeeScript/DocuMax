/**
 * The single source of truth for entity-kind wording. Organizations choose a mode
 * at onboarding: property managers track "properties", contractors track "jobs".
 * Never hard-code "Property" or "Job" in UI — call entityLabels(kind).
 */
export const ENTITY_KINDS = ["property", "job"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface EntityLabels {
  singular: string;
  plural: string;
  statement: string;
  newAction: string;
  /** Field labels for the entity form. */
  fields: { name: string; code: string; address: string; clientName: string };
  /** Example values shown as placeholders. */
  examples: { name: string; code: string; address: string; clientName: string };
}

const LABELS: Record<EntityKind, EntityLabels> = {
  property: {
    singular: "Property",
    plural: "Properties",
    statement: "Monthly cost statement",
    newAction: "Add property",
    fields: { name: "Property name", code: "Reference", address: "Address", clientName: "Owner" },
    examples: {
      name: "12 Elm Street",
      code: "ELM-12",
      address: "12 Elm Street, Springfield",
      clientName: "J. Rivera",
    },
  },
  job: {
    singular: "Job",
    plural: "Jobs",
    statement: "Job cost statement",
    newAction: "Add job",
    fields: { name: "Job name", code: "Job number", address: "Site address", clientName: "Client" },
    examples: {
      name: "Kitchen remodel",
      code: "J-1042",
      address: "88 Harbor Road, Bayview",
      clientName: "M. Chen",
    },
  },
};

export function entityLabels(kind: EntityKind): EntityLabels {
  return LABELS[kind];
}
