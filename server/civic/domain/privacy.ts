import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CivicHashPurpose = "vote" | "region" | "profile" | "proposal-owner";

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function deriveCsrfToken(token: string): string {
  return createHmac("sha256", token)
    .update("civica:csrf:v1", "utf8")
    .digest("base64url");
}

export function deriveScopedHash(
  token: string,
  purpose: CivicHashPurpose,
  resourceId: string
): string {
  return createHmac("sha256", token)
    .update(`civica:${purpose}:v1:${resourceId}`, "utf8")
    .digest("hex");
}

export function safeTokenEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
