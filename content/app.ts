import { Building2, FileText, HardHat, LayoutGrid, Users } from "lucide-react";
import type { EntityKind, EntityLabels } from "@/lib/entities/labels";
import type { OrgRole } from "@/lib/auth/roles";
import type { LucideIcon } from "lucide-react";

/** In-app copy (Phase 2: shell, onboarding, members, invites). Entity wording comes from entityLabels(). */

export interface AppNavItem {
  /** Plain label, or derived from the org's entity wording (properties vs jobs). */
  label: string | ((labels: EntityLabels) => string);
  href: string;
  icon: LucideIcon;
  /** Overrides `icon` per entity kind. */
  iconByKind?: Record<EntityKind, LucideIcon>;
}

export const appNav: AppNavItem[] = [
  { label: "Dashboard", href: "/app", icon: LayoutGrid },
  {
    label: (l) => l.plural,
    href: "/app/entities",
    icon: Building2,
    iconByKind: { property: Building2, job: HardHat },
  },
  { label: "Documents", href: "/app/documents", icon: FileText },
  { label: "Team", href: "/app/settings/members", icon: Users },
];

export const roleMeta: Record<OrgRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including billing and deleting the organization" },
  admin: { label: "Admin", description: "Manage members, settings and all documents" },
  reviewer: {
    label: "Reviewer",
    description: "Approve, reject and correct extracted data; generate reports",
  },
  member: { label: "Member", description: "Upload documents and work with data" },
  viewer: { label: "Viewer", description: "Read-only access" },
};

export const shellCopy = {
  orgSwitcher: { label: "Switch organization", create: "Create organization" },
  userMenu: { label: "Account menu", logOut: "Log out" },
  openNav: "Open navigation",
};

export const dashboardCopy = {
  greeting: (name: string | null) => (name ? `Welcome, ${name.split(" ")[0]}` : "Welcome"),
  description: "Here's where your organization's work comes together.",
  gettingStarted: "Getting started",
  cards: {
    invite: {
      title: "Invite your team",
      description: "Add reviewers and teammates so documents never wait on one person.",
      cta: "Invite teammates",
    },
    entities: {
      title: (plural: string) => `Set up your ${plural.toLowerCase()}`,
      description: (plural: string) =>
        `${plural} and document uploads arrive in the next release. Your workspace is ready for them.`,
    },
  },
  empty: {
    title: (plural: string) => `No ${plural.toLowerCase()} yet`,
    description: "Once uploads are switched on, recent documents and statements will show up here.",
  },
};

export const onboardingCopy = {
  org: {
    eyebrow: "Step 1 of 2",
    title: "Create your organization",
    description: "This is your team's workspace. You can rename it any time.",
    nameLabel: "Organization name",
    namePlaceholder: "e.g. Harbor & Pine Property Management",
    modeLabel: "What do you track costs for?",
    modes: {
      property: { title: "Properties", description: "Monthly owner statements per property" },
      job: { title: "Jobs", description: "Job cost statements and quotes per job" },
    },
    submit: "Create organization",
  },
  invite: {
    eyebrow: "Step 2 of 2",
    title: "Invite your team",
    description: "Optional — you can always do this later from Team settings.",
    skip: "Skip for now",
    done: "Go to dashboard",
  },
};

export const membersCopy = {
  title: "Team",
  description: "Everyone in this organization and what they can do.",
  membersHeading: "Members",
  invitesHeading: "Pending invites",
  you: "You",
  invite: {
    heading: "Invite a teammate",
    emailLabel: "Email",
    roleLabel: "Role",
    submit: "Create invite link",
    created: "Invite created. Share this link with your teammate — it works once and expires in 7 days.",
    copy: "Copy link",
    copied: "Link copied",
  },
  actions: {
    changeRole: "Change role",
    remove: "Remove",
    revoke: "Revoke",
    leave: "Leave organization",
    removed: "Member removed",
    roleChanged: "Role updated",
    revoked: "Invite revoked",
  },
  readOnly: "Only owners and admins can manage the team.",
  noInvites: "No pending invites.",
  expires: (date: string) => `Expires ${date}`,
};

export const inviteCopy = {
  title: (org: string) => `Join ${org} on DocuMax`,
  description: (role: string, email: string) =>
    `You've been invited as ${role}. The invite was sent to ${email}.`,
  accept: "Accept invite",
  signUp: "Create an account to accept",
  logIn: "I already have an account",
  wrongAccount: (email: string) =>
    `You're signed in with a different email. Log out and sign in as ${email} to accept.`,
  back: "Back to DocuMax",
  logOut: "Log out",
  invalid: {
    title: "This invite can't be used",
    description:
      "It may have expired, been revoked or already been accepted. Ask your teammate for a new link.",
  },
};

export const entitiesCopy = {
  description: (plural: string) => `Every cost lands on one of your ${plural.toLowerCase()}.`,
  views: { label: "View", grid: "Cards", table: "Table" },
  filters: { label: "Show", active: "Active", archived: "Archived" },
  columns: { status: "Status", documents: "Documents" },
  status: { active: "Active", archived: "Archived" },
  dialog: {
    createTitle: (singular: string) => `Add ${singular.toLowerCase()}`,
    editTitle: (singular: string) => `Edit ${singular.toLowerCase()}`,
    save: "Save",
    cancel: "Cancel",
    optional: "Optional",
  },
  actions: {
    edit: "Edit",
    archive: "Archive",
    restore: "Restore",
    menu: (name: string) => `Actions for ${name}`,
    created: (singular: string) => `${singular} added`,
    saved: "Changes saved",
    archived: (singular: string) => `${singular} archived`,
    restored: (singular: string) => `${singular} restored`,
  },
  empty: {
    active: {
      title: (plural: string) => `No ${plural.toLowerCase()} yet`,
      description: (singular: string) =>
        `Add your first ${singular.toLowerCase()} so uploaded costs have somewhere to go.`,
    },
    archived: { title: "Nothing archived", description: "Archived items will appear here." },
  },
  readOnly: "Only owners and admins can add or edit these.",
};

export const documentsCopy = {
  title: "Documents",
  description: "Supplier invoices and receipts, from upload to checked data.",
  dropzone: {
    title: "Drop invoices and receipts here",
    hint: (types: string) => `${types} · up to 25 MB each · many at once`,
    choose: "Choose files",
    active: "Release to upload",
  },
  assignLabel: (singular: string) => `Assign to ${singular.toLowerCase()} (optional)`,
  unassigned: "Not assigned",
  tray: {
    heading: "Uploads",
    clear: "Clear finished",
    statuses: {
      rejected: "Not uploaded",
      waiting: "Waiting",
      hashing: "Preparing",
      uploading: "Uploading",
      confirming: "Finishing",
      done: "Uploaded",
      error: "Failed",
    },
    duplicate: (name: string) => `Looks identical to “${name}”, uploaded earlier.`,
    view: "View",
    progress: (name: string) => `Upload progress for ${name}`,
  },
  list: {
    caption: "Documents",
    columns: { name: "File", entity: "Assigned to", uploaded: "Uploaded", size: "Size", status: "Status" },
    empty: {
      title: "No documents yet",
      description: "Upload your first invoice or receipt to see it processed here.",
    },
    readOnly: "You have read-only access, so uploading is turned off.",
  },
  detail: {
    back: "All documents",
    retry: "Retry processing",
    retried: "Processing restarted",
    download: "Download original",
    facts: { status: "Status", entity: "Assigned to", uploaded: "Uploaded", size: "Size", pages: "Pages" },
    failed: "Processing failed",
  },
  preview: {
    loading: "Loading preview…",
    unavailable: "Preview isn't available for this file type. Download the original to view it.",
    error: "The preview couldn't be loaded.",
    page: (n: number, total: number) => `Page ${n} of ${total}`,
    thumbnails: "Pages",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetZoom: "Reset zoom",
  },
  live: (name: string, status: string) => `${name}: ${status}`,
};
