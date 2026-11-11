import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AuthAside } from "@/components/marketing/auth-aside";
import { authContent } from "@/content/auth";

/** Split-screen auth layout: form left, brand board right (hidden below lg). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-4 py-6 sm:px-10">
        <Link href="/" aria-label="DocuMax home" className="self-start">
          <Logo />
        </Link>
        <main className="flex flex-1 items-center justify-center py-12">{children}</main>
      </div>
      <aside className="hidden lg:block">
        <AuthAside title={authContent.aside.title} points={authContent.aside.points} />
      </aside>
    </div>
  );
}
