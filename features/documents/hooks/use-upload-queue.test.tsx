import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useUploadQueue } from "./use-upload-queue";

const mocks = vi.hoisted(() => ({
  requestUpload: vi.fn(),
  confirmUpload: vi.fn(),
  putWithProgress: vi.fn(),
  sha256Hex: vi.fn(async () => "a".repeat(64)),
}));
vi.mock("../actions", () => ({ requestUpload: mocks.requestUpload, confirmUpload: mocks.confirmUpload }));
vi.mock("../upload-client", () => ({ putWithProgress: mocks.putWithProgress, sha256Hex: mocks.sha256Hex }));

const pdf = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  let n = 0;
  mocks.requestUpload.mockImplementation(async () => ({
    ok: true,
    data: { documentId: `doc-${(n += 1)}`, uploadUrl: "https://storage/x", duplicateOf: null },
  }));
  mocks.confirmUpload.mockResolvedValue({ ok: true, data: { status: "queued" } });
});

describe("useUploadQueue", () => {
  it("rejects unsupported and oversized files without uploading them", () => {
    const { result } = renderHook(() => useUploadQueue());
    act(() =>
      result.current.add([
        new File(["x"], "notes.docx", { type: "application/msword" }),
        { name: "huge.pdf", type: "application/pdf", size: 26_214_401 } as File,
      ]),
    );
    expect(result.current.items.map((i) => [i.name, i.status, i.error])).toEqual([
      ["notes.docx", "rejected", "Unsupported file type. Upload PDF, JPG, PNG, WEBP or HEIC."],
      ["huge.pdf", "rejected", "File is larger than 25 MB."],
    ]);
    expect(mocks.requestUpload).not.toHaveBeenCalled();
  });

  it("runs at most 3 uploads at a time and finishes all 20", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: (() => void)[] = [];
    mocks.putWithProgress.mockImplementation(
      (_url: string, _file: File, _type: string, onProgress: (p: number) => void) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        onProgress(50);
        return new Promise<void>((resolve) =>
          releases.push(() => {
            inFlight -= 1;
            resolve();
          }),
        );
      },
    );
    const onUploaded = vi.fn();
    const { result } = renderHook(() => useUploadQueue({ onUploaded }));
    act(() =>
      result.current.add(
        Array.from({ length: 20 }, (_, i) => pdf(`f${i}.pdf`)),
        "entity-1",
      ),
    );

    await waitFor(() => expect(releases).toHaveLength(3));
    expect(result.current.items.filter((i) => i.status === "uploading")).toHaveLength(3);
    expect(result.current.items.filter((i) => i.status === "waiting")).toHaveLength(17);

    for (let released = 0; released < 20; released += 1) {
      await waitFor(() => expect(releases.length).toBeGreaterThan(released));
      await act(async () => releases[released]());
    }
    await waitFor(() => expect(result.current.items.every((i) => i.status === "done")).toBe(true));
    expect(maxInFlight).toBe(3);
    expect(onUploaded).toHaveBeenCalledTimes(20);
    expect(mocks.requestUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: "application/pdf",
        sizeBytes: 10,
        sha256: "a".repeat(64),
        entityId: "entity-1",
      }),
    );
    expect(result.current.items[0].href).toMatch(/^\/app\/documents\/doc-\d+$/);
  });

  it("surfaces server errors, duplicate warnings and network failures per file", async () => {
    mocks.requestUpload
      .mockResolvedValueOnce({ ok: false, error: "You don't have permission to do that." })
      .mockResolvedValueOnce({
        ok: true,
        data: { documentId: "d2", uploadUrl: "u", duplicateOf: { id: "d0", fileName: "old.pdf" } },
      })
      .mockResolvedValueOnce({ ok: true, data: { documentId: "d3", uploadUrl: "u", duplicateOf: null } });
    mocks.putWithProgress.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useUploadQueue({ concurrency: 1 }));
    act(() => result.current.add([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]));
    await waitFor(() =>
      expect(result.current.items.every((i) => ["done", "error"].includes(i.status))).toBe(true),
    );
    const byName = Object.fromEntries(result.current.items.map((i) => [i.name, i]));
    expect(byName["a.pdf"]).toMatchObject({
      status: "error",
      error: "You don't have permission to do that.",
    });
    expect(byName["b.pdf"]).toMatchObject({
      status: "done",
      warning: "Looks identical to “old.pdf”, uploaded earlier.",
    });
    expect(byName["c.pdf"]).toMatchObject({ status: "error", error: expect.stringMatching(/Upload failed/) });
  });
});
