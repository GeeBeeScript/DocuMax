/** Visually hidden polite live region for status announcements (e.g. "invoice.pdf: Ready"). */
export function LiveRegion({ message }: { message: string }) {
  return (
    <p aria-live="polite" role="status" className="sr-only">
      {message}
    </p>
  );
}
