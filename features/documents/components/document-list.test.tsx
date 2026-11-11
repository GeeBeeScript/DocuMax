import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type { DocumentRow } from "../queries";
import { DocumentList } from "./document-list";

type Handler = (payload: { new: Record<string, unknown> }) => void;
const realtime = vi.hoisted(() => ({
  handler: null as Handler | null,
  filter: "",
  removed: false,
  token: null as string | null,
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    const channel = {
      on: (_event: string, opts: { filter: string }, handler: Handler) => {
        realtime.filter = opts.filter;
        realtime.handler = handler;
        return channel;
      },
      subscribe: () => channel,
    };
    return {
      auth: { getSession: async () => ({ data: { session: { access_token: "user-jwt" } } }) },
      realtime: {
        setAuth: async (token: string | null) => {
          realtime.token = token;
        },
      },
      channel: () => channel,
      removeChannel: async () => {
        realtime.removed = true;
      },
    };
  },
}));

const docs: DocumentRow[] = [
  {
    id: "d1",
    fileName: "invoice.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    status: "queued",
    entityName: "Elm",
    createdAt: "2026-11-12T10:00:00Z",
  },
  {
    id: "d2",
    fileName: "receipt.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 4096,
    status: "ready",
    entityName: null,
    createdAt: "2026-11-12T09:00:00Z",
  },
];
const row = (name: string) => screen.getByRole("rowheader", { name }).closest("tr")!;

beforeEach(() => Object.assign(realtime, { handler: null, filter: "", removed: false, token: null }));

describe("DocumentList", () => {
  it("lists documents with links, entity and status", () => {
    render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    expect(screen.getByRole("link", { name: "invoice.pdf" })).toHaveAttribute("href", "/app/documents/d1");
    expect(within(row("invoice.pdf")).getByText("Elm")).toBeInTheDocument();
    expect(within(row("invoice.pdf")).getByText("Queued")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Property" })).toBeInTheDocument();
  });

  it("subscribes (as the signed-in user) to this org's documents and updates + announces changes live", async () => {
    const { unmount } = render(<DocumentList orgId="org-1" documents={docs} entityHeader="Property" />);
    await waitFor(() => expect(realtime.filter).toBe("org_id=eq.org-1"));
    expect(realtime.token).toBe("user-jwt");
    act(() => realtime.handler!({ new: { id: "d1", status: "extracting", error: null } }));
    expect(within(row("invoice.pdf")).getByText("Reading text")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("invoice.pdf: Reading text");

    act(() => realtime.handler!({ new: { id: "d1", status: "not-a-status" } }));
    expect(within(row("invoice.pdf")).getByText("Reading text")).toBeInTheDocument();
    unmount();
    expect(realtime.removed).toBe(true);
  });
});
