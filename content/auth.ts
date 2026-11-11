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
  magicLink: {
    toggle: "Email me a sign-in link instead",
    togglePassword: "Use my password instead",
    submit: "Send sign-in link",
    sent: "If an account exists for that address, a sign-in link is on its way.",
  },
  confirmEmail: "Check your inbox to confirm your email, then come back to log in.",
  linkError: "That sign-in link is invalid or has expired. Request a new one.",
  errors: {
    invalidCredentials: "Incorrect email or password.",
    emailTaken: "An account with this email already exists. Log in instead.",
    generic: "Something went wrong. Please try again.",
  },
};
