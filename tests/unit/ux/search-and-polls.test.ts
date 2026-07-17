import { describe, expect, it } from "vitest";
import { groupSearchDomains, type GroupedSearchResults } from "@/lib/search/household-search";

describe("search grouping", () => {
  it("orders domains and skips empties", () => {
    const grouped: GroupedSearchResults = {
      chores: [
        {
          id: "1",
          domain: "chores",
          title: "Trash",
          snippet: "",
          href: "/c",
        },
      ],
      calendar: [
        {
          id: "2",
          domain: "calendar",
          title: "Trash day",
          snippet: "",
          href: "/e",
        },
      ],
    };
    expect(groupSearchDomains(grouped).map((g) => g.domain)).toEqual([
      "calendar",
      "chores",
    ]);
  });
});

describe("poll result calculation", () => {
  it("tallies votes per option", () => {
    const options = [
      { id: "a", label: "Yes" },
      { id: "b", label: "No" },
    ];
    const votes = [
      { option_id: "a" },
      { option_id: "a" },
      { option_id: "b" },
    ];
    const tallies = Object.fromEntries(
      options.map((o) => [
        o.id,
        votes.filter((v) => v.option_id === o.id).length,
      ]),
    );
    expect(tallies).toEqual({ a: 2, b: 1 });
  });
});
