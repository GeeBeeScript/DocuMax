/**
 * Setup file: lets Server Actions run in integration tests as real users. Only Next's request plumbing is
 * mocked — the server Supabase client is the current test user's client (`actAs`), redirect() throws a
 * `Redirect`, revalidation is a no-op, and enqueue() records jobs instead of hitting Redis.
 */
import { vi } from "vitest";

export class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}

interface MockState {
  client: unknown;
  enqueued: { queue: string; payload: unknown; jobId?: string }[];
}
const state: MockState = ((globalThis as { __actionMocks?: MockState }).__actionMocks ??= {
  client: null,
  enqueued: [],
});

/** Run subsequent actions as this user (anything with a Supabase `client`). */
export function actAs(user: { client: unknown }) {
  state.client = user.client;
}

/** Jobs passed to enqueue() since the last reset. */
export const enqueued = () => state.enqueued;
export const resetEnqueued = () => state.enqueued.splice(0);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => state.client,
}));
vi.mock("@/lib/queue/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queue/connection")>();
  const { jobSchemas } = await import("@/lib/queue/jobs");
  return {
    ...actual,
    enqueue: async (queue: keyof typeof jobSchemas, payload: unknown, jobId?: string) => {
      const data = jobSchemas[queue].parse(payload); // same validation as the real enqueue()
      state.enqueued.push({ queue, payload: data, jobId });
      return { id: jobId ?? "test-job" };
    },
  };
});
