export interface CivicHttpConfig {
  origin: string | null;
  allowedOrigins: string[];
  secureCookies: boolean;
  configured: boolean;
  mapsBaseUrl: string | null;
  mapBrowserKey: string | null;
}

function parseHttpsBase(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function loadCivicHttpConfig(
  env: Record<string, string | undefined> = process.env
): CivicHttpConfig {
  const rawOrigin = env.CIVICA_ORIGIN;
  const allowedOrigins: string[] = [];
  if (rawOrigin) {
    let parsed: URL;
    try {
      parsed = new URL(rawOrigin);
    } catch {
      throw new Error("civic_origin_invalid");
    }
    const localHttp =
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      env.CIVICA_TEST_MODE === "1";
    if (
      parsed.origin !== rawOrigin ||
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== "https:" && !localHttp)
    ) {
      throw new Error("civic_origin_invalid");
    }
    allowedOrigins.push(parsed.origin);
  } else if (env.NODE_ENV !== "production" && env.CIVICA_TEST_MODE === "1") {
    allowedOrigins.push("http://127.0.0.1:3000", "http://localhost:3000");
  }

  const origin = allowedOrigins[0] ?? null;
  const mapsBase = parseHttpsBase(env.MANUS_API_URL);
  const mapBrowserKey = env.MANUS_API_BROWSER_KEY?.trim() || null;

  return {
    origin,
    allowedOrigins,
    secureCookies: allowedOrigins.every(value => value.startsWith("https://")),
    configured: allowedOrigins.length > 0,
    mapsBaseUrl: mapsBase,
    mapBrowserKey,
  };
}
