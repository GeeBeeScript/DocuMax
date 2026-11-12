import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { privacy } from "@/content/legal";

export const metadata: Metadata = { title: privacy.title, description: privacy.intro };

export default function PrivacyPage() {
  return <LegalPage doc={privacy} />;
}
