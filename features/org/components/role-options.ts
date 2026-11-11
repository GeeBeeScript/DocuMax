import { roleMeta } from "@/content/app";
import type { OrgRole } from "@/lib/auth/roles";

export const roleOptions = (roles: readonly OrgRole[]) =>
  roles.map((r) => ({ value: r, label: roleMeta[r].label }));
