import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DesktopNav } from "@/components/marketing/desktop-nav";
import { HeaderShell } from "@/components/marketing/header-shell";
import { MobileNav } from "@/components/marketing/mobile-nav";

describe("SiteHeader › HeaderShell", () => {
  it("adds the scrolled state once the page scrolls", () => {
    render(<HeaderShell>content</HeaderShell>);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-scrolled", "false");

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header).toHaveAttribute("data-scrolled", "true");

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header).toHaveAttribute("data-scrolled", "false");
  });
});

describe("SiteHeader › DesktopNav mega-menu", () => {
  it("opens on click and closes with Escape", async () => {
    render(<DesktopNav />);
    const trigger = screen.getByRole("button", { name: "Solutions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(await screen.findByRole("link", { name: /Home-service contractors/ })).toHaveAttribute(
      "href",
      "/contractors",
    );

    fireEvent.keyDown(document.activeElement ?? trigger, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("opens from the keyboard", async () => {
    render(<DesktopNav />);
    const trigger = screen.getByRole("button", { name: "Product" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger); // Enter on a native button dispatches click in browsers; jsdom doesn't.
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
  });
});

describe("SiteHeader › MobileNav drawer", () => {
  it("opens, expands a group, and closes after choosing a link", async () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Solutions" }));
    const link = await screen.findByRole("link", { name: "Home-service contractors" });
    fireEvent.click(link);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes with Escape", async () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
