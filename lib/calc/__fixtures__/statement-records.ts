import type { StatementEntity, StatementRecord } from "../statement";

/** A month of activity for two properties (golden-file fixture for buildStatement / buildPortfolio). */

export const entities: StatementEntity[] = [
  {
    id: "elm",
    name: "12 Elm Street",
    code: "ELM",
    address: "12 Elm Street, Springfield",
    clientName: "J. Rivera",
  },
  { id: "oak", name: "4 Oak Court", code: "OAK", address: null, clientName: null },
];

const base = {
  documentType: "invoice",
  currency: "USD",
  status: "approved",
  lines: [],
  allocations: [],
} as const;

export const records: StatementRecord[] = [
  {
    ...base,
    id: "r-plumbing",
    supplierName: "Brightline Plumbing Co.",
    invoiceNumber: "INV-2041",
    issueDate: "2026-10-14",
    category: "repairs_maintenance",
    entityId: "elm",
    taxCents: 9607,
    totalCents: 126057,
    lines: [
      {
        id: "l1",
        position: 1,
        description: "Replace water heater valve",
        category: "repairs_maintenance",
        amountCents: 42000,
      },
      {
        id: "l2",
        position: 2,
        description: "Labor 3.5 hours",
        category: "labor_subcontract",
        amountCents: 56000,
      },
      { id: "l3", position: 3, description: "Copper fittings", category: "materials", amountCents: 18450 },
    ],
  },
  {
    // Split 60/40 between the two properties.
    ...base,
    id: "r-landscaping",
    supplierName: "Green Thumb Landscaping",
    invoiceNumber: "GT-88",
    issueDate: "2026-10-03",
    category: "landscaping",
    entityId: "elm",
    taxCents: 0,
    totalCents: 45000,
    allocations: [
      { lineItemId: null, entityId: "elm", method: "percent", percentBp: 6000, amountCents: null },
      { lineItemId: null, entityId: "oak", method: "percent", percentBp: 4000, amountCents: null },
    ],
  },
  {
    // Credit note printed with a positive total.
    ...base,
    id: "r-credit",
    documentType: "credit_note",
    supplierName: "Brightline Plumbing Co.",
    invoiceNumber: "CN-12",
    issueDate: "2026-10-20",
    category: "repairs_maintenance",
    entityId: "elm",
    taxCents: 0,
    totalCents: 5000,
  },
  {
    ...base,
    id: "r-utility",
    supplierName: "City Water",
    invoiceNumber: "W-1001",
    issueDate: "2026-10-31",
    category: "utilities",
    entityId: "oak",
    taxCents: 0,
    totalCents: 8913,
  },
  // Excluded: not approved, outside the period, another currency (reported separately), no entity.
  {
    ...base,
    id: "r-pending",
    status: "needs_review",
    supplierName: "X",
    invoiceNumber: null,
    issueDate: "2026-10-05",
    category: null,
    entityId: "elm",
    taxCents: 0,
    totalCents: 99999,
  },
  {
    ...base,
    id: "r-september",
    supplierName: "Y",
    invoiceNumber: null,
    issueDate: "2026-09-30",
    category: null,
    entityId: "elm",
    taxCents: 0,
    totalCents: 77777,
  },
  {
    ...base,
    id: "r-euro",
    currency: "EUR",
    supplierName: "Z GmbH",
    invoiceNumber: null,
    issueDate: "2026-10-09",
    category: "materials",
    entityId: "elm",
    taxCents: 0,
    totalCents: 1500,
  },
  {
    ...base,
    id: "r-unassigned",
    supplierName: "Office Depot",
    invoiceNumber: null,
    issueDate: "2026-10-11",
    category: "office_admin",
    entityId: null,
    taxCents: 0,
    totalCents: 2599,
  },
];
