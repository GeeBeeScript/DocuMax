import {
  Building2,
  ClipboardCheck,
  FileChartColumn,
  Settings,
  FileText,
  HardHat,
  History,
  LayoutGrid,
  SlidersHorizontal,
  Users,
} from "lucide-react";
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
  /** Only shown to these roles (all members when omitted). */
  roles?: readonly OrgRole[];
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
  { label: "Review", href: "/app/review", icon: ClipboardCheck },
  { label: "Reports", href: "/app/reports", icon: FileChartColumn },
  { label: "Team", href: "/app/settings/members", icon: Users },
  { label: "Organization", href: "/app/settings/organization", icon: Settings, roles: ["owner", "admin"] },
  {
    label: "Review settings",
    href: "/app/settings/review",
    icon: SlidersHorizontal,
    roles: ["owner", "admin"],
  },
  { label: "Audit log", href: "/app/settings/audit", icon: History, roles: ["owner", "admin"] },
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
      description: (plural: string) => `${plural} are where costs land. Add them once, then assign uploads.`,
      cta: (plural: string) => `Open ${plural.toLowerCase()}`,
    },
    upload: {
      title: "Upload documents",
      description: "Drop in invoices and receipts — many at once. DocuMax takes it from there.",
      cta: "Upload documents",
    },
  },
  recent: "Recent documents",
  viewAll: "View all",
  empty: {
    title: "No documents yet",
    description: "Upload your first invoice or receipt and watch it get processed.",
    cta: "Upload documents",
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
  tabs: { data: "Extracted data", preview: "Preview", text: "Extracted text" },
  record: {
    pending: {
      title: "No extracted data yet",
      description: "Fields appear here once the AI has read the document.",
    },
    readOnlyNote: "Read-only here — open it in Review to correct, approve or reject.",
    openInReview: "Open in Review",
    fields: {
      documentType: "Document type",
      supplier: "Supplier",
      taxId: "Supplier tax ID",
      invoiceNumber: "Invoice number",
      issueDate: "Issue date",
      dueDate: "Due date",
      currency: "Currency",
      subtotal: "Subtotal",
      tax: "Tax",
      total: "Total",
      category: "Category",
      entity: (singular: string) => singular,
    },
    lowestConfidence: "Lowest required-field confidence",
    lines: {
      caption: "Line items",
      description: "Description",
      quantity: "Qty",
      unitPrice: "Unit price",
      amount: "Amount",
      category: "Category",
      confidence: "Confidence",
    },
    noLines: "No line items were found on this document.",
    documentTypes: {
      invoice: "Invoice",
      receipt: "Receipt",
      credit_note: "Credit note",
      quote: "Quote",
      statement: "Statement",
      other: "Other",
    },
    categories: {
      repairs_maintenance: "Repairs & maintenance",
      materials: "Materials",
      labor_subcontract: "Labor & subcontractors",
      utilities: "Utilities",
      cleaning: "Cleaning",
      landscaping: "Landscaping",
      insurance: "Insurance",
      taxes_fees: "Taxes & fees",
      professional_services: "Professional services",
      equipment_rental: "Equipment rental",
      travel_fuel: "Travel & fuel",
      office_admin: "Office & admin",
      other: "Other",
    },
  },
  text: {
    page: (n: number) => `Page ${n}`,
    sources: { textLayer: "Text layer", ocr: "OCR" },
    emptyPage: "No text found on this page.",
    pending: {
      title: "Text not extracted yet",
      description: "It appears here as soon as the document has been read — usually within seconds.",
    },
    lowConfidence: "Low OCR confidence — check this page against the preview.",
  },
};

export const reviewCopy = {
  title: "Review",
  description:
    "Check what the AI read, fix anything that's off, and approve. Errors first, then oldest first.",
  queue: {
    caption: "Records awaiting review",
    columns: {
      document: "Document",
      supplier: "Supplier",
      entity: (singular: string) => singular,
      total: "Total",
      confidence: "Confidence",
      issues: "Issues",
    },
    clean: "No issues",
    countsLabel: "Filter by issue",
    all: (n: number) => `All (${n})`,
    cleanFilter: "Clean",
    filters: {
      legend: "Filters",
      entity: (singular: string) => singular,
      anyEntity: (plural: string) => `All ${plural.toLowerCase()}`,
      supplier: "Supplier",
      supplierPlaceholder: "Search suppliers",
      confidence: "Confidence",
      anyConfidence: "Any confidence",
      lowConfidence: "Below threshold",
      okConfidence: "At or above threshold",
      apply: "Apply",
      clear: "Clear filters",
    },
    showing: (shown: number, total: number) =>
      shown === total ? `${total} awaiting review` : `${shown} of ${total} awaiting review`,
    empty: {
      title: "Nothing to review",
      description: "New documents land here when they need a look. Enjoy the quiet.",
    },
    noMatches: {
      title: "No records match these filters",
      description: "Clear the filters to see the whole queue.",
    },
    bulk: {
      button: (n: number) => `Approve ${n} clean ${n === 1 ? "item" : "items"}`,
      confirmTitle: "Approve clean items?",
      confirmBody: (n: number) =>
        `${n} ${n === 1 ? "record has" : "records have"} no issues. Approving records them as checked by you.`,
      confirm: "Approve all",
      cancel: "Cancel",
      done: (n: number) => `Approved ${n} ${n === 1 ? "record" : "records"}`,
    },
  },
  item: {
    back: "Review queue",
    position: (n: number, total: number) => `${n} of ${total}`,
    notInQueue: "Not in the queue",
    prev: "Previous (K)",
    next: "Next (J)",
    document: "Document",
    noDocument: "This record has no source document.",
    sections: { fields: "Extracted fields", lines: "Line items", history: "History" },
    edited: "Edited",
    clean: "No issues — ready to approve.",
    issueCount: (errors: number, warnings: number) =>
      [
        errors && `${errors} ${errors === 1 ? "error" : "errors"}`,
        warnings && `${warnings} ${warnings === 1 ? "warning" : "warnings"}`,
      ]
        .filter(Boolean)
        .join(", "),
    fix: "Go to field",
    viewDuplicate: "Open the other document",
    noEntity: (singular: string) => `No ${singular.toLowerCase()}`,
    none: "—",
    amountHint: "e.g. 1,260.57",
    invalidAmount: "Enter an amount like 1,260.57",
    invalidDate: "Use the date picker or YYYY-MM-DD",
    invalidCurrency: "Use a 3-letter code like USD",
    invalidNumber: "Enter a number like 3.5",
    actions: {
      approve: "Approve",
      reject: "Reject",
      save: "Save corrections",
      reopen: "Reopen",
      unsaved: (n: number) => `${n} unsaved ${n === 1 ? "change" : "changes"}`,
      fixErrors: "Fix the highlighted fields first.",
    },
    toasts: {
      approved: "Approved",
      rejected: "Rejected",
      saved: "Corrections saved",
      reopened: "Reopened for review",
      queueDone: "That was the last one — the queue is clear.",
    },
    decided: {
      approved: (who: string | null, when: string) =>
        `Approved${who ? ` by ${who}` : " automatically"} · ${when}`,
      rejected: (when: string) => `Rejected · ${when}`,
      reopenHint: "Reopen it to make changes.",
    },
    readOnly: "You can view this record, but only reviewers can approve, reject or correct it.",
    reason: {
      rejectTitle: "Reject this record?",
      rejectBody: "Say why — it's kept in the audit log.",
      approveTitle: "Approve with errors?",
      approveBody: "This record still has errors. Say why it's fine to approve anyway.",
      label: "Reason",
      placeholder: "e.g. Confirmed the total with the supplier",
      required: "Give a reason.",
      cancel: "Cancel",
      reject: "Reject",
      approve: "Approve anyway",
    },
    lines: {
      caption: "Line items (editable)",
      add: "Add line",
      removeHeader: "Remove",
      remove: (n: number) => `Remove line ${n}`,
      cell: (column: string, n: number) => `${column}, line ${n}`,
      empty: "No line items. Add them if the document lists any.",
    },
    shortcuts: {
      title: "Keyboard shortcuts",
      toggle: "Keyboard shortcuts (?)",
      items: [
        { keys: ["A"], label: "Approve and go to the next item" },
        { keys: ["R"], label: "Reject (asks for a reason)" },
        { keys: ["E"], label: "Edit — jump to the first flagged field" },
        { keys: ["J"], label: "Next item" },
        { keys: ["K"], label: "Previous item" },
        { keys: ["Ctrl", "S"], label: "Save corrections" },
        { keys: ["Esc"], label: "Leave the field (shortcuts work again)" },
        { keys: ["?"], label: "Show or hide this list" },
      ],
    },
  },
  issues: {
    duplicate_file: "Same file uploaded before",
    duplicate: "Possible duplicate",
    missing_field: "Missing field",
    total_mismatch: "Total doesn't add up",
    lines_mismatch: "Lines don't match subtotal",
    line_math: "Line math is off",
    low_confidence: "Low confidence",
    date_suspicious: "Suspicious date",
    no_entity: "No property or job",
  },
  timeline: {
    title: "History",
    system: "DocuMax",
    extracted: "Extracted by AI",
    approve: "approved",
    reject: "rejected",
    reopen: "reopened",
    correct: (field: string) => `changed ${field}`,
    lineItems: "line items",
    lineCount: (n: number) => `${n} ${n === 1 ? "line" : "lines"}`,
    empty: "(empty)",
    /** Labels for other audited columns (audit log). */
    columnLabels: {
      status: "Status",
      name: "Name",
      file_name: "File",
      page_count: "Pages",
      attempts: "Attempts",
      role: "Role",
      email: "Email",
      code: "Code",
      address: "Address",
      description: "Description",
      amount_cents: "Amount",
      approved_by: "Approved by",
      approved_at: "Approved at",
      min_confidence: "Lowest confidence",
      error: "Error",
    } as Record<string, string>,
  },
};

export const auditCopy = {
  title: "Audit log",
  description: "Every change to your organization's data: who, when, and what changed.",
  caption: "Audit log entries",
  columns: { when: "When", who: "Who", what: "What", changes: "Changes" },
  filters: {
    table: "Data",
    anyTable: "All data",
    actor: "Person",
    anyActor: "Everyone",
    apply: "Apply",
    clear: "Clear",
  },
  tables: {
    organizations: "Organization",
    memberships: "Membership",
    invites: "Invite",
    entities: "Property / job",
    documents: "Document",
    records: "Record",
    line_items: "Line item",
    extractions: "Extraction",
    document_pages: "Document page",
    validation_issues: "Validation issue",
    review_actions: "Review action",
  } as Record<string, string>,
  actions: { insert: "created", update: "updated", delete: "deleted" },
  system: "DocuMax",
  unknownActor: "Former member",
  older: "Older entries",
  newest: "Back to newest",
  empty: { title: "No entries", description: "Changes show up here as soon as they happen." },
  more: (n: number) => `+${n} more`,
  forbidden: "Only owners and admins can see the audit log.",
};

export const reviewSettingsCopy = {
  title: "Review settings",
  description: "Decide when documents need a person to look at them.",
  threshold: {
    label: "Confidence threshold (%)",
    hint: "Fields the AI is less sure about than this are flagged for review.",
    invalid: "Enter a whole number from 50 to 100.",
  },
  autoApprove: {
    label: "Auto-approve clean documents",
    hint: "Records with no issues at all are approved without a person. Everything else still goes to review.",
  },
  save: "Save settings",
  saved: "Review settings saved",
  forbidden: "Only owners and admins can change review settings.",
};

export const allocationCopy = {
  title: (plural: string) => `Split across ${plural.toLowerCase()}`,
  description: (plural: string) =>
    `Share this cost between several ${plural.toLowerCase()}. Statements use the split.`,
  none: (name: string | null, singular: string) =>
    name
      ? `Counts 100% to ${name}.`
      : `Not assigned to a ${singular.toLowerCase()} yet — it won't appear on any statement.`,
  start: "Split this cost",
  edit: "Edit split",
  methods: { percent: "By percentage", amount: "By amount" },
  methodLabel: "Split method",
  entity: (singular: string) => singular,
  value: { percent: "Share (%)", amount: "Amount" },
  result: "Result",
  add: (singular: string) => `Add ${singular.toLowerCase()}`,
  remove: (n: number) => `Remove row ${n}`,
  removeHeader: "Remove",
  rest: (name: string | null) => (name ? `Rest stays with ${name}` : "Rest stays unassigned"),
  totalPercent: (pct: string) => `Total: ${pct}%`,
  save: "Save split",
  clear: "Remove split",
  cancel: "Cancel",
  saved: "Split saved",
  cleared: "Split removed",
  invalidPercent: "Enter a percentage like 33.33",
  invalidAmount: "Enter an amount like 200.00",
  chooseEntity: "Choose…",
  lineSplitsNote: "Some lines of this record are split individually; saving a split here replaces those.",
  noTotal: "Add the total before splitting this record.",
  readOnly: "Only reviewers can change splits.",
  rejected: "Rejected records aren't split.",
};

export const statementsCopy = {
  back: (plural: string) => `All ${plural.toLowerCase()}`,
  period: {
    legend: "Period",
    previous: "Previous month",
    next: "Next month",
    month: "Month",
    show: "Show",
    custom: "Custom range",
    from: "From",
    to: "To",
    thisMonth: "This month",
  },
  tiles: { gross: "Total costs", net: "Before tax", tax: "Tax", records: "Records" },
  categories: {
    title: "By category",
    caption: "Costs by category",
    category: "Category",
    amount: "Total",
    share: "Share",
  },
  suppliers: { title: "Top suppliers", records: (n: number) => `${n} ${n === 1 ? "record" : "records"}` },
  lines: {
    title: "Costs",
    caption: "Approved costs in this period",
    date: "Date",
    supplier: "Supplier",
    description: "Description",
    category: "Category",
    amount: "Amount",
    split: "Split",
    splitHint: "This cost is shared with other properties or jobs.",
  },
  empty: {
    title: "No approved costs in this period",
    description:
      "Approved records dated in this period show up here. Try another month, or review pending documents.",
    cta: "Open review",
  },
  otherCurrencies: (list: string) => `Not included (other currencies): ${list}.`,
  uncategorized: "Uncategorized",
  unknownSupplier: "Unknown supplier",
  onlyApproved: "Only approved records are counted.",
  facts: { code: "Reference", address: "Address", client: "Client" },
};

export const reportsCopy = {
  title: "Reports",
  description:
    "Branded PDF statements, summaries and quotes. Generated in the background — download when ready.",
  kinds: { statement: "Statement", summary: "Summary", quote: "Quote" },
  status: { queued: "Queued", rendering: "Generating", ready: "Ready", failed: "Failed" },
  batchStatus: { running: "Generating", zipping: "Zipping", ready: "Ready", failed: "Failed" },
  columns: {
    name: "Report",
    kind: "Type",
    period: "Period",
    status: "Status",
    created: "Created",
    download: "Download",
  },
  caption: "Generated reports",
  download: "Download",
  downloadZip: "Download ZIP",
  pages: (n: number) => `${n} ${n === 1 ? "page" : "pages"}`,
  batches: {
    title: "Batches",
    progress: (done: number, total: number) => `${done} of ${total} statements`,
    failed: (n: number) => `${n} failed`,
    label: (period: string) => `Statements · ${period}`,
  },
  empty: {
    title: "No reports yet",
    description: "Generate a statement from a property or job page, or all statements for a month at once.",
  },
  readOnly: "Only reviewers, admins and owners can generate reports.",
  actions: {
    batch: (plural: string) => `Statements for all ${plural.toLowerCase()}`,
    summary: "Portfolio summary",
    statement: "Generate statement",
    quote: "Create quote",
  },
  dialogs: {
    month: "Month",
    batchTitle: (plural: string) => `Statements for all ${plural.toLowerCase()}`,
    batchBody: (plural: string) =>
      `One PDF per active ${plural.toLowerCase().replace(/s$/, "")}, plus a ZIP with all of them. Only approved costs are included.`,
    summaryTitle: "Portfolio summary",
    summaryBody: "One PDF with every property's or job's totals for the month.",
    statementTitle: "Generate statement",
    statementBody: (name: string, period: string) => `${name} · ${period}. Only approved costs are included.`,
    quoteTitle: "Create quote",
    quoteBody:
      "Prices the job's approved costs (before tax) with your markup. Costs and markup aren't shown to the client.",
    from: "Costs from",
    to: "Costs to",
    markup: "Markup (%)",
    tax: "Sales tax (%)",
    validDays: "Valid for (days)",
    notes: "Notes for the client (optional)",
    invalidPercent: "Enter a percentage like 15 or 8.25",
    cancel: "Cancel",
    generate: "Generate",
    queued: "Generating — it'll be ready in a moment.",
    viewReports: "View reports",
  },
};

export const organizationCopy = {
  title: "Organization",
  description: 'Branding for your PDFs, and the time zone used for "this month".',
  logo: {
    label: "Logo",
    hint: "PNG, JPG or WEBP, up to 2 MB. Shown at the top of every PDF page.",
    choose: "Upload logo",
    replace: "Replace logo",
    remove: "Remove logo",
    uploading: "Uploading…",
    tooBig: "That file is larger than 2 MB.",
    wrongType: "Use a PNG, JPG or WEBP image.",
    alt: (org: string) => `${org} logo`,
  },
  color: { label: "Brand colour", hint: "Used for the bar at the top of each PDF page." },
  footer: {
    label: "Footer text",
    hint: "Shown at the bottom of every PDF page, e.g. your address or licence number.",
  },
  timezone: { label: "Time zone", hint: 'Decides which month is "this month" on statements.' },
  save: "Save",
  saved: "Organization settings saved",
  forbidden: "Only owners and admins can change organization settings.",
};
