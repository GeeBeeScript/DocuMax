import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthForm
      mode="login"
      defaultEmail={first(params.email) ?? ""}
      next={first(params.next)}
      linkError={params.error === "link"}
    />
  );
}
