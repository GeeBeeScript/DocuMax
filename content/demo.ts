/**
 * Sample data rendered inside marketing product mockups. Fictional suppliers/addresses.
 * Amounts in cents (same rules as the real app).
 */
import { cents } from "@/lib/calc/money";
import type { DocumentStatus } from "@/lib/documents/status";

export const demoInvoice = {
  supplier: "Brightline Plumbing Co.",
  number: "INV-4021",
  date: "Oct 14, 2026",
  entity: "12 Elm Street",
  lines: [
    { description: "Replace water heater valve", amount: cents(42000) },
    { description: "Labor — 3.5 hrs", amount: cents(56000) },
    { description: "Copper fittings", amount: cents(18450) },
  ],
  subtotal: cents(116450),
  tax: cents(11950),
  total: cents(128400),
};

export const demoFields = [
  { label: "Supplier", value: "Brightline Plumbing Co.", confidence: 0.99 },
  { label: "Invoice #", value: "INV-4021", confidence: 0.98 },
  { label: "Date", value: "2026-10-14", confidence: 0.97 },
  { label: "Total", value: "$1,284.00", confidence: 0.99 },
  { label: "Tax", value: "$119.50", confidence: 0.72 },
  { label: "Category", value: "Repairs & maintenance", confidence: 0.91 },
] as const;

export const demoUploads: { name: string; status: DocumentStatus }[] = [
  { name: "brightline-inv-4021.pdf", status: "ready" },
  { name: "receipt-hardware-store.jpg", status: "analyzing" },
  { name: "greenway-landscaping-oct.pdf", status: "needs_review" },
  { name: "scan_0045.pdf", status: "extracting" },
];

export const demoStatement = {
  title: "Monthly cost statement",
  entity: "12 Elm Street",
  period: "October 2026",
  rows: [
    { category: "Repairs & maintenance", amount: cents(128400) },
    { category: "Landscaping", amount: cents(32000) },
    { category: "Utilities", amount: cents(21875) },
    { category: "Cleaning", amount: cents(18000) },
  ],
  total: cents(200275),
  pages: 6,
};

export const demoIssues = [
  { tone: "attention" as const, text: "Tax amount read with 72% confidence" },
  { tone: "danger" as const, text: "Possible duplicate of INV-4021 (Oct 3)" },
];
