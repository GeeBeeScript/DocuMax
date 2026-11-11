import { LayoutGrid, Users } from "lucide-react";
import type { OrgRole } from "@/lib/auth/roles";
import type { LucideIcon } from "lucide-react";

/** In-app copy (Phase 2: shell, onboarding, members, invites). Entity wording comes from entityLabels(). */

export interface AppNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const appNav: AppNavItem[] = [
  { label: "Dashboard", href: "/app", icon: LayoutGrid },
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
  invalid: {
    title: "This invite can't be used",
    description:
      "It may have expired, been revoked or already been accepted. Ask your teammate for a new link.",
  },
};
