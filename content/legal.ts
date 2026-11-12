/**
 * Terms of Service and Privacy Policy — DRAFTS. They describe how DocuMax actually works (data, sub-processors,
 * retention) but have not been reviewed by a lawyer; `draftNotice` stays until they are.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  draftNotice: string | null;
  intro: string;
  sections: LegalSection[];
}

const DRAFT = "Draft — pending legal review. These terms are not yet in effect.";

export const terms: LegalDocument = {
  title: "Terms of Service",
  updated: "2026-11-12",
  draftNotice: DRAFT,
  intro:
    "These terms govern your organization's use of DocuMax, a service that turns supplier invoices and receipts into checked, structured data and reports.",
  sections: [
    {
      heading: "Your account and organization",
      paragraphs: [
        "You need an account to use DocuMax. The person who creates an organization is its owner and is responsible for who they invite and which roles they give.",
        "Keep your password confidential. Tell us right away if you think your account has been used without permission.",
      ],
    },
    {
      heading: "Your data",
      paragraphs: [
        "Documents you upload and the data extracted from them belong to your organization. We process them only to provide the service: reading the text, extracting fields, validating them, and producing the reports you ask for.",
        "AI extraction proposes values; your reviewers approve them. Figures in statements are calculated by DocuMax from approved data. You remain responsible for checking documents before relying on them.",
      ],
    },
    {
      heading: "Plans, billing and limits",
      paragraphs: [
        "Paid plans renew automatically each month or year until canceled. Payments are processed by Stripe. Cancellations and downgrades take effect at the end of the current period.",
        "Each plan includes a monthly number of documents and seats. When a limit is reached, new uploads or invites are paused until the next month or an upgrade.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "Don't upload content you don't have the right to process, try to access other organizations' data, overload or probe the service, or use it for anything unlawful.",
      ],
    },
    {
      heading: "Ending your use",
      paragraphs: [
        "Owners can export their data at any time and delete their organization, which permanently removes its documents, data and files.",
        "We may suspend accounts that break these terms or leave invoices unpaid, after notice where possible.",
      ],
    },
    {
      heading: "Liability",
      paragraphs: [
        "DocuMax is provided as is. To the extent the law allows, our liability is limited to the fees you paid in the twelve months before a claim.",
      ],
    },
  ],
};

export const privacy: LegalDocument = {
  title: "Privacy Policy",
  updated: "2026-11-12",
  draftNotice: DRAFT,
  intro: "This policy explains what personal data DocuMax processes, why, and the choices you have.",
  sections: [
    {
      heading: "What we collect",
      paragraphs: [
        "Account data: your name, email address and password (stored hashed by our authentication provider).",
        "Organization data: the documents your team uploads and the data extracted from them. These can contain names and addresses of suppliers or clients; we process them on your organization's behalf.",
        "Usage data: which actions were taken and when (the audit log your owners and admins can see), and error reports without personal details.",
      ],
    },
    {
      heading: "How we use it",
      paragraphs: [
        "To run the service: extraction, validation, review, reports, billing and support. We don't sell personal data and don't use your documents to train AI models.",
      ],
    },
    {
      heading: "Service providers",
      paragraphs: [
        "Supabase (database, authentication, file storage), Vercel and our worker host (application hosting), Upstash (queues), Stripe (payments), Sentry (error reports, scrubbed of personal details), and an AI model provider for extraction, configured so prompts are not retained or used for training.",
      ],
    },
    {
      heading: "Retention",
      paragraphs: [
        "Organization data is kept while the organization exists. Deleting an organization removes its documents, data and files immediately; backups expire on our provider's schedule.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You can access and export your organization's data in the app, correct your profile, and ask us to delete your account. Contact privacy@documax.app.",
      ],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "We use only the cookies needed to keep you signed in. There are no analytics or advertising cookies, so there's no cookie banner.",
      ],
    },
  ],
};
