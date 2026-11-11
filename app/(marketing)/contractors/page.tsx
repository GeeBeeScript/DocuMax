import type { Metadata } from "next";
import { IndustryPage } from "@/components/marketing/industry-page";
import { contractors } from "@/content/industries";

export const metadata: Metadata = contractors.metadata;

export default function ContractorsPage() {
  return <IndustryPage content={contractors} />;
}
