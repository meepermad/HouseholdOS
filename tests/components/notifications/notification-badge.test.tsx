import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";

describe("NotificationBadge", () => {
  it("shows the unread count", () => {
    render(<NotificationBadge count={3} />);
    expect(screen.getByLabelText("3 unread notifications")).toHaveTextContent(
      "3",
    );
  });

  it("caps display at 99+", () => {
    render(<NotificationBadge count={120} />);
    expect(
      screen.getByLabelText("120 unread notifications"),
    ).toHaveTextContent("99+");
  });

  it("hides when count is 0", () => {
    const { container } = render(<NotificationBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
