import { describe, expect, it } from "vitest";
import { loadCivicHttpConfig } from "./config";

describe("civic runtime configuration", () => {
  it("accepts one exact HTTPS origin and marks cookies secure", () => {
    const config = loadCivicHttpConfig({
      NODE_ENV: "production",
      CIVICA_ORIGIN: "https://civica.example",
      MANUS_API_URL: "https://api.example/v1",
      MANUS_API_BROWSER_KEY: "public-browser-key",
    });
    expect(config.allowedOrigins).toEqual(["https://civica.example"]);
    expect(config.configured).toBe(true);
    expect(config.secureCookies).toBe(true);
    expect(config.mapsBaseUrl).toBe("https://api.example/v1");
    expect(config.mapBrowserKey).toBe("public-browser-key");
  });

  it.each([
    "http://civica.example",
    "https://civica.example/path",
    "https://user:password@civica.example",
    "https://civica.example?redirect=https://evil.example",
  ])("rejects a non-origin CIVICA_ORIGIN value: %s", origin => {
    expect(() => loadCivicHttpConfig({ NODE_ENV: "production", CIVICA_ORIGIN: origin })).toThrow("civic_origin_invalid");
  });

  it("allows HTTP only for an explicit localhost test origin", () => {
    const config = loadCivicHttpConfig({
      NODE_ENV: "production",
      CIVICA_TEST_MODE: "1",
      CIVICA_ORIGIN: "http://localhost:4100",
    });
    expect(config.allowedOrigins).toEqual(["http://localhost:4100"]);
    expect(config.secureCookies).toBe(false);
    expect(() => loadCivicHttpConfig({ NODE_ENV: "production", CIVICA_ORIGIN: "http://localhost:4100" })).toThrow("civic_origin_invalid");
  });

  it("ignores insecure or credential-bearing map base URLs", () => {
    const config = loadCivicHttpConfig({
      CIVICA_ORIGIN: "https://civica.example",
      MANUS_API_URL: "http://api.example",
    });
    expect(config.mapsBaseUrl).toBeNull();
  });
});
