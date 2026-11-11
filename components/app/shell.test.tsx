import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { AppNav } from "./app-nav";
import { AppSidebar } from "./app-sidebar";
import { EmptyState } from "./empty-state";
import { FormAlert } from "./form-alert";
import { initials } from "./initials";
import { OrgSwitcher } from "./org-switcher";
import { PageHeader } from "./page-header";
import { QuickStartCard } from "./quick-start-card";
import { SelectField } from "./select-field";
import { StepHeading } from "./step-heading";
import { TextField } from "./text-field";
import { TopBar } from "./top-bar";
import { UserMenu } from "./user-menu";

const pathname = vi.hoisted(() => ({ value: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("static app pieces", () => {
  it("PageHeader renders an h1, description and actions", () => {
    render(<PageHeader title="Team" description="Who's here" actions={<button>Do</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Team" })).toBeInTheDocument();
    expect(screen.getByText("Who's here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do" })).toBeInTheDocument();
  });

  it("EmptyState renders title, description and action", () => {
    render(<EmptyState icon={Inbox} title="Nothing yet" description="Soon" action={<a href="/x">Go</a>} />);
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go" })).toBeInTheDocument();
  });

  it("QuickStartCard renders an article with its heading", () => {
    render(<QuickStartCard icon={Inbox} title="Invite" description="Add people" />);
    expect(screen.getByRole("article")).toHaveTextContent("Add people");
  });

  it("StepHeading renders eyebrow and h1", () => {
    render(<StepHeading eyebrow="Step 1" title="Create" />);
    expect(screen.getByRole("heading", { level: 1, name: "Create" })).toBeInTheDocument();
  });

  it("FormAlert uses alert for errors and status otherwise", () => {
    render(
      <>
        <FormAlert tone="danger">Bad</FormAlert>
        <FormAlert tone="success">Good</FormAlert>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Bad");
    expect(screen.getByRole("status")).toHaveTextContent("Good");
  });

  it("AppSidebar renders its slots and a dashboard link", () => {
    render(<AppSidebar switcher={<div>switcher</div>} nav={<div>nav</div>} />);
    expect(screen.getByRole("link", { name: "DocuMax dashboard" })).toHaveAttribute("href", "/app");
    expect(screen.getByText("switcher")).toBeInTheDocument();
  });

  it.each([
    ["Dana Whitfield", "d@x.co", "DW"],
    ["Cher", "c@x.co", "C"],
    ["  Mary Ann Lee ", "m@x.co", "ML"],
    [null, "sam@x.co", "S"],
  ])("initials(%s, %s) = %s", (name, email, expected) => {
    expect(initials(name, email)).toBe(expected);
  });
});

describe("form fields", () => {
  it("TextField links its error to the input", () => {
    render(<TextField id="email" label="Email" error="Required" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Required");
  });

  it("TextField shows a hint when there is no error", () => {
    render(<TextField id="pw" label="Password" hint="8+ characters" />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("8+ characters");
  });

  it("SelectField renders options and keeps a hidden label accessible", () => {
    render(
      <SelectField
        id="role"
        label="Role"
        hideLabel
        options={[
          { value: "a", label: "Admin" },
          { value: "v", label: "Viewer" },
        ]}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});

describe("AppNav", () => {
  it("marks only the current page", () => {
    pathname.value = "/app/settings/members";
    render(<AppNav entityKind="job" />);
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});

describe("OrgSwitcher", () => {
  const orgs = [
    { id: "a", name: "Alpha PM", roleLabel: "Owner" },
    { id: "b", name: "Beta Trades", roleLabel: "Viewer" },
  ];
  const labels = { label: "Switch organization", create: "Create organization" };

  it("shows the active org and switches to another", async () => {
    const onSwitch = vi.fn().mockResolvedValue({ ok: true });
    render(<OrgSwitcher orgs={orgs} activeId="a" onSwitch={onSwitch} labels={labels} />);
    const trigger = screen.getByRole("button", { name: "Switch organization" });
    expect(trigger).toHaveTextContent("Alpha PM");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Beta Trades/ }));
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith("b"));
    expect(screen.queryByRole("menuitem", { name: /Alpha PM/ })).toBeNull(); // menu closed
  });

  it("offers creating another organization", async () => {
    render(<OrgSwitcher orgs={orgs} activeId="a" onSwitch={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch organization" }));
    expect(await screen.findByRole("menuitem", { name: "Create organization" })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });
});

describe("UserMenu", () => {
  it("shows initials and logs out", async () => {
    const onLogOut = vi.fn().mockResolvedValue(undefined);
    render(
      <UserMenu
        name="Dana Whitfield"
        email="d@x.co"
        onLogOut={onLogOut}
        labels={{ label: "Account", logOut: "Log out" }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Account" });
    expect(trigger).toHaveTextContent("DW");
    fireEvent.click(trigger);
    expect(await screen.findByText("d@x.co")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(onLogOut).toHaveBeenCalled();
  });
});

describe("TopBar", () => {
  it("opens the navigation drawer and closes it on route change", async () => {
    pathname.value = "/app";
    const { rerender } = render(<TopBar menuLabel="Open navigation" drawer={<a href="/app/x">Inside</a>} />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Inside");
    pathname.value = "/app/settings/members";
    rerender(<TopBar menuLabel="Open navigation" drawer={<a href="/app/x">Inside</a>} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
