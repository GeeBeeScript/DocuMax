import type { Metadata } from "next";
import { IndustryPage } from "@/components/marketing/industry-page";
import { propertyManagers } from "@/content/industries";

export const metadata: Metadata = propertyManagers.metadata;

export default function PropertyManagersPage() {
  return <IndustryPage content={propertyManagers} />;
}
