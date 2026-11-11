import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ShieldCheck } from "lucide-react";
import { AlternatingFeature } from "@/components/marketing/alternating-feature";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { CalloutBand } from "@/components/marketing/callout-band";
import { CheckList } from "@/components/marketing/check-list";
import { CtaBand } from "@/components/marketing/cta-band";
import { EmailCtaForm } from "@/components/marketing/email-cta-form";
import { Faq } from "@/components/marketing/faq";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { Hero } from "@/components/marketing/hero";
import { LogoStrip } from "@/components/marketing/logo-strip";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { PersonaCards } from "@/components/marketing/persona-cards";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingTable } from "@/components/marketing/pricing-table";
import { ResourceLinks } from "@/components/marketing/resource-links";
import { ShowcaseVisual } from "@/components/marketing/visuals/showcase-visual";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StatsRow } from "@/components/marketing/stats-row";
import { Testimonial } from "@/components/marketing/testimonial";
import { TrustGrid } from "@/components/marketing/trust-grid";
import { UseCaseTabs } from "@/components/marketing/use-case-tabs";
import { WorkflowSteps } from "@/components/marketing/workflow-steps";
import {
  features,
  highlights,
  homeCta,
  homeHero,
  homeTestimonial,
  personas,
  resources,
  stats,
  useCases,
} from "@/content/marketing";
import { comparison, planCards, pricingFaq, security } from "@/content/pricing";
import { propertyManagers } from "@/content/industries";
import { SHOWCASE_KINDS } from "@/content/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

describe("static marketing blocks", () => {
  it("AnnouncementBar renders text and link", () => {
    render(<AnnouncementBar text="News" link={{ label: "Read", href: "/x" }} />);
    expect(screen.getByRole("link", { name: /Read/ })).toHaveAttribute("href", "/x");
  });

  it("Hero renders an h1 with the marked phrase and the email CTA", () => {
    render(<Hero content={homeHero} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(homeHero.title.marked);
    expect(screen.getByRole("button", { name: homeHero.cta.label })).toBeInTheDocument();
  });

  it("LogoStrip lists every name", () => {
    render(<LogoStrip heading="Trusted" names={["A Co", "B Co"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("StatsRow renders each stat", () => {
    render(<StatsRow stats={stats} />);
    for (const s of stats) expect(screen.getByText(s.value)).toBeInTheDocument();
  });

  it("Testimonial renders quote and attribution", () => {
    render(<Testimonial content={homeTestimonial} />);
    expect(screen.getByText(homeTestimonial.name)).toBeInTheDocument();
  });

  it("FeatureGrid renders one card per feature", () => {
    render(<FeatureGrid items={features.items} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(features.items.length);
  });

  it("PersonaCards link to persona pages", () => {
    render(<PersonaCards items={personas.items} />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(personas.items.map((p) => p.href));
  });

  it("CalloutBand, ResourceLinks, CtaBand render their headings", () => {
    render(
      <>
        <CalloutBand icon={ShieldCheck} eyebrow="E" title="Callout" description="D" />
        <ResourceLinks title={resources.title} items={resources.items} />
        <CtaBand content={homeCta} />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Callout" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: resources.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: homeCta.title })).toBeInTheDocument();
  });

  it("WorkflowSteps renders an ordered list", () => {
    render(<WorkflowSteps steps={propertyManagers.workflow.steps} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(propertyManagers.workflow.steps.length);
  });

  it("TrustGrid renders badges", () => {
    render(<TrustGrid items={security.items} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(security.items.length);
  });

  it("MarketingSection renders intro heading and children", () => {
    render(
      <MarketingSection intro={{ title: "Intro title", eyebrow: "Eyebrow" }}>
        <p>Body</p>
      </MarketingSection>,
    );
    expect(screen.getByRole("heading", { name: "Intro title" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it.each(SHOWCASE_KINDS)("ShowcaseVisual renders the %s visual", (kind) => {
    const { container } = render(<ShowcaseVisual kind={kind} />);
    expect(container.firstChild).not.toBeEmptyDOMElement();
  });

  it("AlternatingFeature renders a row per item and flips every other row", () => {
    render(<AlternatingFeature items={highlights.items} />);
    const rows = screen
      .getAllByRole("listitem")
      .filter((li) => li.parentElement?.tagName === "UL" && li.querySelector("h3"));
    expect(rows).toHaveLength(highlights.items.length);
    for (const item of highlights.items) {
      expect(screen.getByRole("heading", { level: 3, name: item.title })).toBeInTheDocument();
    }
    expect(rows[0].firstElementChild).not.toHaveClass("lg:order-2");
    expect(rows[1].firstElementChild).toHaveClass("lg:order-2");
  });

  it("CheckList renders every item", () => {
    render(<CheckList items={["One", "Two"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("SiteFooter renders column navs", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("navigation", { name: "Product" })).toBeInTheDocument();
  });
});

describe("EmailCtaForm", () => {
  it("routes to sign-up with the email prefilled", () => {
    render(<EmailCtaForm label="Go" placeholder="Email" />);
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(push).toHaveBeenCalledWith("/signup?email=a%40b.co");
  });
});

describe("UseCaseTabs", () => {
  it("switches panels when a tab is clicked", () => {
    render(<UseCaseTabs tabs={useCases.tabs} />);
    expect(screen.getByRole("heading", { name: useCases.tabs[0].heading })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Review/ }));
    expect(screen.getByRole("tab", { name: /Review/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: useCases.tabs[2].heading })).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<UseCaseTabs tabs={useCases.tabs} />);
    const [first, second] = screen.getAllByRole("tab");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    await waitFor(() => expect(second).toHaveFocus());
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: useCases.tabs[1].heading })).toBeInTheDocument();

    fireEvent.keyDown(second, { key: "ArrowLeft" });
    await waitFor(() => expect(first).toHaveFocus());
    expect(first).toHaveAttribute("aria-selected", "true");
  });
});

describe("PricingCards", () => {
  it("defaults to yearly prices and switches to monthly", () => {
    render(<PricingCards cards={planCards} />);
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(within(pro).getByText("$39")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(within(pro).getByText("$49")).toBeInTheDocument();
  });

  it("shows caps from the plan catalogue", () => {
    render(<PricingCards cards={planCards} />);
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(within(pro).getByText(/^500 documents \/ month/)).toBeInTheDocument();
  });
});

describe("PricingTable", () => {
  it("is collapsed until expanded", () => {
    render(<PricingTable groups={comparison} cards={planCards} />);
    const toggle = screen.getByRole("button", { name: /Compare all features/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Documents per month" })).toBeInTheDocument();
  });
});

describe("Faq", () => {
  it("renders each question as an expandable trigger", () => {
    render(<Faq items={pricingFaq.items} />);
    const first = screen.getByRole("button", { name: pricingFaq.items[0].question });
    expect(first).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
  });
});
