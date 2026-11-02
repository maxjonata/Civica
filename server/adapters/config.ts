import { PilotError, type RuntimeConfig } from "../ports/pilot";
export function loadRuntimeConfig(
  env: Record<string, string | undefined>
): RuntimeConfig {
  const defaults: RuntimeConfig = {
    rpID: "",
    origins: [],
    primaryOrigin: "",
    secureCookies: true,
    sessionLifetimeMs: 8 * 60 * 60 * 1000,
    sessionIdleMs: 30 * 60 * 1000,
    recentAuthMs: 5 * 60 * 1000,
    maxAccounts: 2,
    configured: false,
  };
  if (!env.CIVICA_ORIGIN && !env.CIVICA_RP_ID) return defaults;
  try {
    if (!env.CIVICA_ORIGIN || !env.CIVICA_RP_ID) throw new Error("Incomplete");
    const origin = new URL(env.CIVICA_ORIGIN);
    const local = ["localhost", "127.0.0.1"].includes(origin.hostname);
    if (
      origin.origin !== env.CIVICA_ORIGIN ||
      origin.username ||
      origin.password ||
      origin.hostname !== env.CIVICA_RP_ID ||
      (origin.protocol !== "https:" &&
        !(origin.protocol === "http:" && local && env.CIVICA_TEST_MODE === "1"))
    )
      throw new Error("Invalid");
    return {
      ...defaults,
      rpID: env.CIVICA_RP_ID,
      origins: [origin.origin],
      primaryOrigin: origin.origin,
      secureCookies: origin.protocol === "https:",
      configured: true,
    };
  } catch {
    throw new PilotError("INVALID_ORIGIN_CONFIGURATION", 503);
  }
}
export function assertTestDatabase(value: string): void {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "mysql:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !/^\/civica_test_[a-z0-9_]+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error("Unsafe");
  } catch {
    throw new PilotError("UNSAFE_TEST_DATABASE", 503);
  }
}
