import { Container } from "@/components/brand/section";

/** "Trusted by" row of customer wordmarks (text-only placeholders until real logos are licensed). */
export function LogoStrip({ heading, names }: { heading: string; names: readonly string[] }) {
  return (
    <section aria-label={heading} className="py-10">
      <Container>
        <p className="text-center text-sm font-semibold text-gray-500">{heading}</p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {names.map((n) => (
            <li key={n} className="font-heading text-lg font-bold tracking-tight text-gray-500">
              {n}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
