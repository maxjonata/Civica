import { describe, it, expect } from "vitest";
import { loadRuntimeConfig, assertTestDatabase } from "./config";
describe("explicit origin and database configuration", () => {
  it("is blocked by default, never infers public origin from request Host", () => {
    expect(loadRuntimeConfig({}).configured).toBe(false);
  });
  it("accepts only an explicit matching HTTPS RP origin", () => {
    const c = loadRuntimeConfig({
      CIVICA_ORIGIN: "https://pilot.example.org",
      CIVICA_RP_ID: "pilot.example.org",
    });
    expect(c.configured).toBe(true);
    expect(c.origins).toEqual(["https://pilot.example.org"]);
    expect(c.secureCookies).toBe(true);
  });
  it("rejects broad RP IDs, nonmatching hosts, querystrings and remote HTTP", () => {
    for (const [origin, rp] of [
      ["https://evil.example", "example.org"],
      ["https://pilot.example.org/path", "pilot.example.org"],
      ["http://pilot.example.org", "pilot.example.org"],
      ["https://pilot.example.org", "example.org"],
      ["https://pilot.example.org?x=1", "pilot.example.org"],
    ])
      expect(() =>
        loadRuntimeConfig({ CIVICA_ORIGIN: origin, CIVICA_RP_ID: rp })
      ).toThrow("INVALID_ORIGIN_CONFIGURATION");
  });
  it("local HTTP is accepted only in explicitly isolated protocol test mode", () => {
    expect(() =>
      loadRuntimeConfig({
        CIVICA_ORIGIN: "http://localhost:3000",
        CIVICA_RP_ID: "localhost",
      })
    ).toThrow("INVALID_ORIGIN_CONFIGURATION");
    expect(
      loadRuntimeConfig({
        CIVICA_ORIGIN: "http://localhost:3000",
        CIVICA_RP_ID: "localhost",
        CIVICA_TEST_MODE: "1",
      }).secureCookies
    ).toBe(false);
  });
  it("refuses shared or remote databases for adversarial tests", () => {
    for (const url of [
      "mysql://u:p@remote.example/civica_test_a",
      "mysql://u:p@127.0.0.1/production",
      "mysql://u:p@127.0.0.1/civica_test_a?ssl=1",
    ])
      expect(() => assertTestDatabase(url)).toThrow("UNSAFE_TEST_DATABASE");
    expect(() =>
      assertTestDatabase("mysql://u:p@127.0.0.1/civica_test_protocol")
    ).not.toThrow();
  });
});
