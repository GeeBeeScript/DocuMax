import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FileDropzone } from "./file-dropzone";
import { UploadTray, type UploadItem } from "./upload-tray";

const dropLabels = {
  title: "Drop files",
  hint: "PDF up to 25 MB",
  choose: "Choose files",
  active: "Release",
};
const file = (name: string, type = "application/pdf") => new File(["x"], name, { type });

describe("FileDropzone", () => {
  it("passes dropped files to onFiles and highlights while dragging", () => {
    const onFiles = vi.fn();
    render(<FileDropzone accept=".pdf" onFiles={onFiles} labels={dropLabels} />);
    const zone = screen.getByText("Drop files").parentElement!;
    fireEvent.dragOver(zone);
    expect(screen.getByText("Release")).toBeInTheDocument();
    fireEvent.drop(zone, { dataTransfer: { files: [file("a.pdf"), file("b.png", "image/png")] } });
    expect(onFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a.pdf" }),
      expect.objectContaining({ name: "b.png" }),
    ]);
    expect(screen.getByText("Drop files")).toBeInTheDocument();
  });

  it("opens the picker from a real button and accepts multiple files", () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone accept=".pdf,.png" onFiles={onFiles} labels={dropLabels} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute("accept", ".pdf,.png");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Choose files" }));
    expect(click).toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [file("c.pdf")] } });
    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "c.pdf" })]);
  });

  it("ignores files while disabled", () => {
    const onFiles = vi.fn();
    render(<FileDropzone accept=".pdf" onFiles={onFiles} labels={dropLabels} disabled />);
    fireEvent.drop(screen.getByText("Drop files").parentElement!, {
      dataTransfer: { files: [file("a.pdf")] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeDisabled();
  });
});

describe("UploadTray", () => {
  const labels = {
    heading: "Uploads",
    clear: "Clear finished",
    view: "View",
    progress: (n: string) => `Upload progress for ${n}`,
    statuses: {
      rejected: "Not uploaded",
      waiting: "Waiting",
      hashing: "Preparing",
      uploading: "Uploading",
      confirming: "Finishing",
      done: "Uploaded",
      error: "Failed",
    },
  };
  const items: UploadItem[] = [
    { key: "1", name: "a.pdf", size: "1 KB", status: "uploading", progress: 42.4 },
    {
      key: "2",
      name: "b.pdf",
      size: "2 KB",
      status: "done",
      progress: 100,
      href: "/app/documents/x",
      warning: "Looks identical",
    },
    {
      key: "3",
      name: "c.zip",
      size: "3 KB",
      status: "rejected",
      progress: 0,
      error: "Unsupported file type.",
    },
  ];

  it("renders nothing without items", () => {
    const { container } = render(<UploadTray items={[]} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows progress, status, warnings, errors and links per file", () => {
    render(<UploadTray items={items} labels={labels} onClear={vi.fn()} />);
    expect(screen.getByRole("progressbar", { name: "Upload progress for a.pdf" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    const done = screen.getByText("b.pdf").closest("li")!;
    expect(within(done).getByText("Uploaded")).toBeInTheDocument();
    expect(within(done).getByRole("link", { name: "View" })).toHaveAttribute("href", "/app/documents/x");
    expect(within(done).getByText("Looks identical")).toBeInTheDocument();
    expect(screen.getByText("Unsupported file type.")).toBeInTheDocument();
    // Still busy (a.pdf uploading) → no "Clear finished" yet.
    expect(screen.queryByRole("button", { name: "Clear finished" })).toBeNull();
  });
});
