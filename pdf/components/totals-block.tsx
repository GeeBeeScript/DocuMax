/** Totals under a table (23 mm): up to three rows, the last one the grand total. Values arrive formatted. */
export function TotalsBlock({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="totals block">
      <table>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={i === rows.length - 1 ? "grand" : undefined}>
              <td>{r.label}</td>
              <td className="num">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
