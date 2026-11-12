import { describe, expect, it } from "vitest";
import { BODY_HEIGHT, H, paginateTable } from "./layout";

describe("paginateTable", () => {
  it("a short table fits on the first page with its totals", () => {
    expect(paginateTable({ rows: 3, before: 100, after: H.totals })).toEqual({
      chunks: [{ page: 0, start: 0, end: 3, first: true, last: true }],
      pageCount: 1,
    });
  });

  it("an empty table is one chunk with no rows", () => {
    expect(paginateTable({ rows: 0, before: 0, after: H.totals }).chunks).toEqual([
      { page: 0, start: 0, end: 0, first: true, last: true },
    ]);
  });

  it("long tables continue on following pages; every chunk fits its page", () => {
    for (const rows of [1, 3, 60, 150, 1000]) {
      const before = 120;
      const { chunks, pageCount } = paginateTable({ rows, before, after: H.totals });
      // Contiguous, complete, in page order.
      expect(chunks[0]!.start).toBe(0);
      expect(chunks.at(-1)!.end).toBe(rows);
      chunks.slice(1).forEach((c, i) => expect(c.start).toBe(chunks[i]!.end));
      expect(pageCount).toBe(chunks.at(-1)!.page + 1);
      for (const c of chunks) {
        const height =
          (c.page === 0 ? before : 0) +
          (c.first ? H.heading : 0) +
          H.head +
          (c.first ? 0 : H.carry) +
          (c.end - c.start) * H.row +
          (c.last ? H.totals : H.carry);
        expect(height).toBeLessThanOrEqual(BODY_HEIGHT);
        expect(c.end - c.start).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("starts the table on page 2 when page 1 is nearly full", () => {
    const { chunks } = paginateTable({ rows: 5, before: BODY_HEIGHT - 20, after: H.totals });
    expect(chunks[0]).toMatchObject({ page: 1, first: true });
  });

  it("never leaves the totals alone on a page", () => {
    // Choose `before` so that all rows fit exactly but the totals don't.
    const rows = 10;
    const before = BODY_HEIGHT - (H.heading + H.head + rows * H.row) - 1;
    const { chunks } = paginateTable({ rows, before, after: H.totals });
    expect(chunks.length).toBe(2);
    expect(chunks[1]!.end - chunks[1]!.start).toBeGreaterThanOrEqual(1);
  });
});
