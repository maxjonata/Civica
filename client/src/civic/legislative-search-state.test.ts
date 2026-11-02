import { describe, expect, it } from "vitest";
import { resolveLegislativeSearchState } from "./legislative-search-state";

describe("legislative search presentation state", () => {
  it("does not claim an empty result before a search", () => {
    expect(
      resolveLegislativeSearchState({ searched: false, loading: false, error: null, matches: [] })
    ).toEqual({ type: "idle" });
  });

  it("shows loading separately from no results", () => {
    expect(
      resolveLegislativeSearchState({ searched: true, loading: true, error: null, matches: [] })
    ).toEqual({ type: "loading" });
  });

  it("reports a completed empty search explicitly", () => {
    expect(
      resolveLegislativeSearchState({ searched: true, loading: false, error: null, matches: [] })
    ).toEqual({ type: "empty" });
  });

  it("keeps source failure separate from an empty result", () => {
    expect(
      resolveLegislativeSearchState({ searched: true, loading: false, error: "source unavailable", matches: [] })
    ).toEqual({ type: "error", message: "source unavailable" });
  });

  it("returns real matches without changing them", () => {
    const matches = ["proposal-a"];
    expect(
      resolveLegislativeSearchState({ searched: true, loading: false, error: null, matches })
    ).toEqual({ type: "results", matches });
  });
});
