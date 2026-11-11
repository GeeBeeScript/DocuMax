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
}

const LABELS: Record<EntityKind, EntityLabels> = {
  property: {
    singular: "Property",
    plural: "Properties",
    statement: "Monthly cost statement",
    newAction: "Add property",
  },
  job: {
    singular: "Job",
    plural: "Jobs",
    statement: "Job cost statement",
    newAction: "Add job",
  },
};

export function entityLabels(kind: EntityKind): EntityLabels {
  return LABELS[kind];
}
