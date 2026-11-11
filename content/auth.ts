export const authContent = {
  login: {
    title: "Welcome back",
    description: "Log in to review documents and send statements.",
    submit: "Log in",
    alt: { prompt: "New to DocuMax?", link: { label: "Sign up free", href: "/signup" } },
  },
  signup: {
    title: "Create your free account",
    description: "25 documents a month free. No credit card required.",
    submit: "Sign up free",
    alt: { prompt: "Already have an account?", link: { label: "Log in", href: "/login" } },
    legal: "By signing up you agree to the Terms and Privacy Policy.",
  },
  aside: {
    title: "Paperwork in. Polished statements out.",
    points: [
      "Invoices and receipts read automatically",
      "Every number checked before it reaches a report",
      "Branded statements per property or job",
    ],
  },
  /** Shown until auth is wired up in Phase 2. */
  pendingNotice: "Accounts open soon — authentication is being connected.",
};
