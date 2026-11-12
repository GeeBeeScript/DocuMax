/** audit_log.actor_id for changes made by the worker (no person). Shown as "DocuMax". */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

export const isSystemActor = (id: string | null | undefined) => id == null || id === SYSTEM_ACTOR_ID;
