/** Four headline figures (20 mm). Values arrive formatted. */
export function ReportTiles({ tiles }: { tiles: { label: string; value: string; emphasis?: boolean }[] }) {
  return (
    <div className="tiles block">
      {tiles.map((t) => (
        <div key={t.label} className={t.emphasis ? "tile emphasis" : "tile"}>
          <p className="label">{t.label}</p>
          <p className="value">{t.value}</p>
        </div>
      ))}
    </div>
  );
}
