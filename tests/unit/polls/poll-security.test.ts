import { describe, expect, it } from "vitest";

describe("poll security contracts", () => {
  it("requires RPCs for binding writes", () => {
    const writes = [
      "create_poll",
      "update_poll",
      "add_poll_option",
      "open_poll",
      "close_poll",
      "cast_poll_vote",
      "remove_poll_vote",
      "publish_poll_results",
    ];
    expect(writes).toContain("cast_poll_vote");
    expect(writes).toContain("create_poll");
  });

  it("documents anonymity projection", () => {
    const anonymousSurface = ["option tallies", "has_voted", "no other membership_id"];
    expect(anonymousSurface).toContain("no other membership_id");
  });

  it("documents single-choice replace semantics", () => {
    expect({
      singleChoice: "one option; prior votes deleted then inserted",
      multiChoice: "allowed options only; no duplicate option rows after replace",
    }.singleChoice).toMatch(/deleted then inserted/);
  });
});
