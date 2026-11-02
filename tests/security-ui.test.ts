import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorBoundary from "../client/src/components/ErrorBoundary";
import { canApproveManualReview } from "../client/src/lib/review-policy";
import { readFile } from "node:fs/promises";
describe("security UI regressions", () => {
  it("does not render error stacks or private payloads in a production-facing boundary", () => {
    const error = new Error("private test payload");
    error.stack = "SENSITIVE_STACK_PROTOCOL_FIXTURE";
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true, error };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).not.toContain("SENSITIVE_STACK_PROTOCOL_FIXTURE");
    expect(html).not.toContain("private test payload");
    expect(html).toContain("Recarregar");
  });
  it("allows the explicitly accepted self-pilot review, without claiming independence", () => {
    expect(
      canApproveManualReview(
        {
          compliance: "valid",
          trustAnchor: "govbr",
          signedContentConfirmed: true,
          identityConfirmed: true,
          reviewerDifferentPersonConfirmed: false,
        },
        true
      )
    ).toBe(true);
    expect(
      canApproveManualReview(
        {
          compliance: "indeterminate",
          trustAnchor: null,
          signedContentConfirmed: false,
          identityConfirmed: false,
          reviewerDifferentPersonConfirmed: false,
        },
        true
      )
    ).toBe(false);
  });
  it("has no automatic browser/network/session-replay debug collector in the Vite build", async () => {
    const text = await readFile(
      new URL("../vite.config.ts", import.meta.url),
      "utf8"
    );
    expect(text).not.toMatch(
      /vitePluginManusDebugCollector|sessionReplay|networkRequests|debug-collector/
    );
  });
});
