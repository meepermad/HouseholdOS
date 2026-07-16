import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InventoryCard } from "@/components/house/InventoryCard";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import type { InventoryItemView } from "@/lib/house/queries";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/h1/house/supplies",
}));

const sampleItem: InventoryItemView = {
  id: "i1",
  name: "Air fryer",
  description: null,
  category: "appliance",
  ownershipMode: "household",
  ownerMembershipId: null,
  ownerLabel: null,
  visibility: "household",
  quantity: "1",
  quantityUnit: "item",
  quantityIsApproximate: false,
  locationId: null,
  locationName: null,
  condition: "good",
  status: "active",
  brand: null,
  model: null,
  serialNumber: null,
  purchaseDate: null,
  purchasePriceCents: null,
  warrantyExpiresAt: null,
  loanReturnAt: null,
  moveOutDisposition: null,
  createdByMembershipId: "m1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("House UI components", () => {
  it("renders inventory card with name and category", () => {
    render(
      <ul>
        <InventoryCard householdId="h1" item={sampleItem} />
      </ul>,
    );
    expect(screen.getByText("Air fryer")).toBeInTheDocument();
    expect(screen.getByText(/Appliance/)).toBeInTheDocument();
  });

  it("marks the active house hub tab from pathname", () => {
    render(<HouseHubTabs householdId="h1" />);
    expect(screen.getByRole("link", { name: "Supplies" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
