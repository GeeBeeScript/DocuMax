import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { mergeStatuses, newer } from "../hooks/use-document-status";
import type { DocumentRow } from "../queries";
import { DocumentList } from "./document-list";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Handler = (payload: { new: Record<string, unknown> }) => void;
const realtime = vi.hoisted(() => ({
  handler: null as Handler | null,
  filter: "",
  removed: false,
  token: null as string | null,
  /** Rows the re-fetch after SUBSCRIBED returns. */
  snapshot: [] as Record<string, unknown>[],
  resyncIds: [] as string[],
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    const channel = {
      on: (_event: string, opts: { filter: string }, handler: Handler) => {
        realtime.filter = opts.filter;
        realtime.handler = handler;
        return channel;
      },
      subscribe: (cb?: (state: string) => void) => {
        cb?.("SUBSCRIBED");
        return channel;
      },
    };
    return {
      auth: { getSession: async () => ({ data: { session: { access_token: "user-jwt" } } }) },
      realtime: {
        setAuth: async (token: string | null) => {
          realtime.token = token;
        },
      },
      from: () => ({
        select: () => ({
          in: async (_col: string, ids: string[]) => {
            realtime.resyncIds = ids;
            return { data: realtime.snapshot };
          },
        }),
      }),
      channel: () => channel,
      removeChannel: async () => {
        realtime.removed = true;
      },
    };
  },
}));

const T0 = "2026-11-12T10:00:00.000Z";
const T1 = "2026-11-12T10:00:01.000Z";
const T2 = "2026-11-12T10:00:02.000Z";
const docs: DocumentRow[] = [
  {
    id: "d1",
    fileName: "invoice.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    status: "queued",
    entityName: "Elm",
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "d2",
    fileName: "receipt.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 4096,
    status: "ready",
    entityName: null,
    createdAt: T0,
    updatedAt: T0,
  },
];
const row = (name: string) => screen.getByRole("rowheader", { name }).closest("tr")!;

beforeEach(() =>
  Object.assign(realtime, {
    handler: null,
    filter: "",
    removed: false,
    token: null,
    snapshot: [],
    resyncIds: [],
  }),
);

describe("status merging", () => {
  const s = (status: "queued" | "failed", updatedAt: string) => ({ status, error: null, updatedAt });

  it("keeps the newer snapshot, whichever order they arrive in", () => {
    expect(newer(s("failed", T2), s("queued", T1))?.status).toBe("failed");
    expect(newer(s("queued", T1), s("failed", T2))?.status).toBe("failed");
    expect(newer(undefined, s("queued", T1))?.status).toBe("queued");
  });

  it("merges sources per document", () => {
    expect(
      mergeStatuses({ a: s("queued", T0), b: s("failed", T2) }, { a: s("failed", T1), b: s("queued", T1) }),
    ).toEqual({
      a: s("failed", T1),
      b: s("failed", T2),
    });
  });
});

describe("DocumentList", () => {
  it("lists documents with links, entity and status", () => {
    render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    expect(screen.getByRole("link", { name: "invoice.pdf" })).toHaveAttribute("href", "/app/documents/d1");
    expect(within(row("invoice.pdf")).getByText("Elm")).toBeInTheDocument();
    expect(within(row("invoice.pdf")).getByText("Queued")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Property" })).toBeInTheDocument();
  });

  it("subscribes as the signed-in user and updates + announces status changes live", async () => {
    const { unmount } = render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    await waitFor(() => expect(realtime.filter).toBe("org_id=eq.org-1"));
    expect(realtime.token).toBe("user-jwt");
    act(() => realtime.handler!({ new: { id: "d1", status: "extracting", error: null, updated_at: T1 } }));
    expect(within(row("invoice.pdf")).getByText("Reading text")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("invoice.pdf: Reading text");

    act(() => realtime.handler!({ new: { id: "d1", status: "not-a-status", updated_at: T2 } }));
    expect(within(row("invoice.pdf")).getByText("Reading text")).toBeInTheDocument();
    unmount();
    expect(realtime.removed).toBe(true);
  });

  it("re-fetches once subscribed, catching changes made while it was connecting", async () => {
    realtime.snapshot = [{ id: "d1", status: "failed", error: "This PDF is damaged", updated_at: T1 }];
    render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    await waitFor(() => expect(within(row("invoice.pdf")).getByText("Failed")).toBeInTheDocument());
    expect(realtime.resyncIds).toEqual(["d1", "d2"]);
  });

  it("never lets an older snapshot overwrite a newer status", async () => {
    render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    await waitFor(() => expect(realtime.handler).not.toBeNull());
    act(() => realtime.handler!({ new: { id: "d1", status: "failed", error: "x", updated_at: T2 } }));
    act(() => realtime.handler!({ new: { id: "d1", status: "extracting", error: null, updated_at: T1 } }));
    expect(within(row("invoice.pdf")).getByText("Failed")).toBeInTheDocument();
  });

  it("re-fetches rows (throttled) when documents leave the AI stage, not on every step", async () => {
    render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    await waitFor(() => expect(realtime.handler).not.toBeNull());
    act(() => realtime.handler!({ new: { id: "d1", status: "analyzing", error: null, updated_at: T1 } }));
    expect(refresh).not.toHaveBeenCalled();
    act(() => realtime.handler!({ new: { id: "d1", status: "validating", error: null, updated_at: T2 } }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
