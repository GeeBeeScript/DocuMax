import { describe, expect, it } from "vitest";
import {
  checkUpload,
  formatBytes,
  MAX_UPLOAD_BYTES,
  resolveUploadType,
  storageFileName,
} from "./upload-rules";

describe("resolveUploadType", () => {
  it.each([
    ["a.pdf", "application/pdf", "application/pdf"],
    ["photo.HEIC", "", "image/heic"],
    ["scan.jpg", "application/octet-stream", "image/jpeg"],
    ["a.pdf", "text/plain", null],
    ["archive.zip", "", null],
    ["noext", "", null],
  ])("%s (%s) → %s", (name, type, expected) => {
    expect(resolveUploadType(name, type)).toBe(expected);
  });
});

describe("checkUpload", () => {
  it("accepts supported files up to exactly 25 MB", () => {
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("rejects oversized, empty and unsupported files", () => {
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 })).toBe("size");
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: 0 })).toBe("empty");
    expect(checkUpload({ name: "a.docx", type: "application/msword", size: 10 })).toBe("type");
  });

  it("matches the database limit", () => {
    expect(MAX_UPLOAD_BYTES).toBe(26_214_400);
  });
});

describe("storageFileName", () => {
  it.each([
    ["Invoice #42 (final).pdf", "Invoice-42-final.pdf"],
    ["Fäktura März.PDF", "Faktura-Marz.pdf"],
    ["../../etc/passwd.pdf", "etc-passwd.pdf"],
    ["   .pdf", "document.pdf"],
  ])("%s → %s", (input, expected) => {
    expect(storageFileName(input)).toBe(expected);
  });

  it("caps long names", () => {
    expect(storageFileName(`${"x".repeat(300)}.pdf`)).toHaveLength(104);
  });
});

it("formatBytes", () => {
  expect([formatBytes(512), formatBytes(2048), formatBytes(5 * 1024 * 1024)]).toEqual([
    "512 B",
    "2 KB",
    "5.0 MB",
  ]);
});
