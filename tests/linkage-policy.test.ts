import { describe, it, expect } from "vitest";
import {
  testedCredentials,
  issuedDocumentId,
} from "../client/src/lib/linkage-policy";
import type { SessionView } from "../shared/pilot";
const keys = [
  {
    id: "a",
    label: "protocol",
    createdAt: 0,
    lastUsedAt: 1,
    isCurrent: true,
    boundToDocument: false,
  },
  {
    id: "b",
    label: "protocol",
    createdAt: 0,
    lastUsedAt: null,
    isCurrent: false,
    boundToDocument: false,
  },
];
describe("vinculation state follows server facts rather than local confirmation", () => {
  it("does not call a primary-key reauthentication a second-key proof", () => {
    expect(testedCredentials(keys)).toBe(false);
    expect(
      testedCredentials([{ ...keys[0] }, { ...keys[1], lastUsedAt: 2 }])
    ).toBe(true);
  });
  it("recovers the issued document after reload/navigation and never invents a new challenge", () => {
    const identity = {
      id: "issued-protocol-id",
      status: "issued",
    } as SessionView["identity"];
    expect(issuedDocumentId(identity)).toBe("issued-protocol-id");
    expect(issuedDocumentId({ ...identity!, status: "submitted" })).toBeNull();
    expect(issuedDocumentId(null)).toBeNull();
  });
});
