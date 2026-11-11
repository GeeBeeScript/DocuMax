import Link from "next/link";
import { Container } from "@/components/brand/section";
import { Logo } from "@/components/brand/logo";
import { footerColumns, footerTrust, legalLinks } from "@/content/footer";
import { siteConfig } from "@/content/site";

/** Multi-column marketing footer with trust row and legal links. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-paper">
      <Container size="wide" className="py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo className="text-paper" />
            <p className="max-w-xs text-sm text-paper/70">{siteConfig.tagline}</p>
          </div>
          {footerColumns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="mb-4 font-heading text-sm font-bold">{col.heading}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-paper/70 hover:text-yellow">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <ul className="mt-12 flex flex-wrap gap-3 border-t border-paper/15 pt-8">
          {footerTrust.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-paper/20 px-3 py-1.5 text-xs text-paper/80"
            >
              <Icon className="size-3.5 text-yellow" />
              {label}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col justify-between gap-4 text-xs text-paper/60 sm:flex-row">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <ul className="flex gap-5">
            {legalLinks.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="hover:text-yellow">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
