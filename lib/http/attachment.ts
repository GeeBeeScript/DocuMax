/** A file download response (`Content-Disposition: attachment`, UTF-8 safe name, never cached). */
export function attachment(body: string | Uint8Array, fileName: string, contentType: string): Response {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(typeof body === "string" ? body : new Blob([body as BlobPart]), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "no-store",
    },
  });
}

export const CSV_TYPE = "text/csv; charset=utf-8";
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Excel needs a byte-order mark to read UTF-8 CSV correctly; the import strips it. */
export const withBom = (csv: string) => `﻿${csv}`;
