import type { RequestIdentity } from "../ports/pilot";

declare module "cookie" {
  export function serialize(
    name: string,
    value: string,
    options?: Record<string, unknown>
  ): string;
}

declare global {
  namespace Express {
    interface Request {
      pilot?: RequestIdentity;
    }
  }
}

export {};
