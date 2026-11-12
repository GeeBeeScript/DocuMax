/** Title block at the top of page 1 (30 mm): what the report is, for whom, and key facts on the right. */
export function ReportHeader({
  eyebrow,
  title,
  subtitle,
  facts,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  facts: [string, string][];
}) {
  return (
    <header className="report-header block">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      <dl>
        {facts.map(([term, value]) => (
          <div key={term} style={{ display: "contents" }}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
