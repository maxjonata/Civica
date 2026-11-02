import { describe, expect, it } from "vitest";
import {
  CHALLENGE_LIFETIME_MS,
  getSessionView,
  hashOpaque,
  issueInvite,
  startCredentialAdd,
  startLogin,
  startRegistration,
  startReauth,
  verifyCredentialAdd,
  verifyLogin,
  verifyRegistration,
  verifyReauth,
  deleteCredential,
  type AuthDependencies,
} from "./auth";
import { MemoryStateRepository } from "../adapters/state";
import type { WebauthnPort } from "../adapters/webauthn";
import type { Clock, RandomSource, RuntimeConfig } from "../ports/pilot";

const config: RuntimeConfig = {
  rpID: "civica.test",
  origins: ["https://civica.test"],
  primaryOrigin: "https://civica.test",
  secureCookies: false,
  sessionLifetimeMs: 8 * 60 * 60 * 1000,
  sessionIdleMs: 30 * 60 * 1000,
  recentAuthMs: 5 * 60 * 1000,
  maxAccounts: 2,
  configured: true,
};

class TestClock implements Clock {
  value = 1_000_000;
  now = () => this.value;
}

class TestRandom implements RandomSource {
  private index = 0;
  token(): string {
    this.index += 1;
    return `opaque-token-${this.index}`;
  }
}

class TestWebauthn implements WebauthnPort {
  async registrationOptions(input: { challenge: string }): Promise<unknown> {
    return { challenge: input.challenge };
  }

  async authenticationOptions(input: { challenge: string }): Promise<unknown> {
    return { challenge: input.challenge };
  }

  async verifyRegistration(input: { response: unknown }): Promise<{
    verified: boolean;
    credential: {
      id: string;
      publicKey: string;
      counter: number;
      transports: string[];
      deviceType: string;
      backedUp: boolean;
    };
  }> {
    const id = (input.response as { id: string }).id;
    return {
      verified: true,
      credential: {
        id,
        publicKey: `pk-${id}`,
        counter: 0,
        transports: [],
        deviceType: "singleDevice",
        backedUp: false,
      },
    };
  }

  async verifyAuthentication(input: {
    response: unknown;
  }): Promise<{ verified: boolean; credentialId: string; newCounter: number }> {
    const id = (input.response as { id: string }).id;
    return { verified: true, credentialId: id, newCounter: 1 };
  }
}

function setup() {
  const repo = new MemoryStateRepository();
  const clock = new TestClock();
  const deps: AuthDependencies = {
    repo,
    config,
    clock,
    random: new TestRandom(),
    webauthn: new TestWebauthn(),
  };
  return { repo, clock, deps };
}

async function context(deps: AuthDependencies) {
  const session = await getSessionView(deps, null, null, () => ({
    documentProtectionReady: false,
    cpfUniquenessReady: false,
  }));
  return { raw: session.rawContext!, hash: hashOpaque(session.rawContext!) };
}

async function register(
  deps: AuthDependencies,
  invite: string,
  contextHash: string,
  credentialId: string
) {
  await startRegistration(deps, { contextHash, nickname: "Pessoa", invite });
  return verifyRegistration(deps, contextHash, { id: credentialId });
}

describe("application auth invariants", () => {
  it("expires a challenge and rejects it without consuming a fresh challenge early", async () => {
    const { deps, clock } = setup();
    const browser = await context(deps);
    await startLogin(deps, browser.hash);
    clock.value += CHALLENGE_LIFETIME_MS;
    await expect(
      verifyLogin(deps, browser.hash, { id: "unknown" })
    ).rejects.toMatchObject({ code: "challenge_invalid" });
    const state = await deps.repo.transact(value => value);
    expect(state.challenges[0]!.usedAt).toBeNull();
  });

  it("allows only one successful registration when two contexts race for one invite", async () => {
    const { deps, repo } = setup();
    const invite = await issueInvite(repo, deps.clock, deps.random);
    const first = await context(deps);
    const second = await context(deps);
    await Promise.all([
      startRegistration(deps, {
        contextHash: first.hash,
        nickname: "Primeira",
        invite,
      }),
      startRegistration(deps, {
        contextHash: second.hash,
        nickname: "Segunda",
        invite,
      }),
    ]);

    const results = await Promise.allSettled([
      verifyRegistration(deps, first.hash, { id: "credential-a" }),
      verifyRegistration(deps, second.hash, { id: "credential-b" }),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(
      1
    );
    await expect(repo.transact(state => state.accounts.length)).resolves.toBe(
      1
    );
  });

  it("expires idle sessions and absolute sessions without leaking account identity", async () => {
    const { deps, clock } = setup();
    const invite = await issueInvite(deps.repo, clock, deps.random);
    const browser = await context(deps);
    const authenticated = await register(
      deps,
      invite,
      browser.hash,
      "credential-a"
    );
    const sessionHash = hashOpaque(authenticated.rawSession!);
    const contextHash = hashOpaque(authenticated.rawContext);

    clock.value += config.sessionIdleMs + 1;
    const idle = await getSessionView(deps, contextHash, sessionHash, () => ({
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    }));
    expect(idle.view.account).toBeNull();

    clock.value =
      authenticated.account.createdAt + config.sessionLifetimeMs + 1;
    const absolute = await getSessionView(
      deps,
      contextHash,
      sessionHash,
      () => ({ documentProtectionReady: false, cpfUniquenessReady: false })
    );
    expect(absolute.view.account).toBeNull();
  });

  it("marks registration credentials unused, records real reauth usage, and blocks deleting the last credential", async () => {
    const { deps, clock } = setup();
    const invite = await issueInvite(deps.repo, clock, deps.random);
    const browser = await context(deps);
    const authenticated = await register(
      deps,
      invite,
      browser.hash,
      "credential-a"
    );
    let sessionHash = hashOpaque(authenticated.rawSession!);
    const contextHash = hashOpaque(authenticated.rawContext);

    await startCredentialAdd(deps, {
      contextHash,
      sessionHash,
      label: "Segunda",
    });
    await verifyCredentialAdd(deps, contextHash, sessionHash, {
      id: "credential-b",
    });
    let state = await deps.repo.transact(value => value);
    expect(
      state.passkeys.find(passkey => passkey.id === "credential-b")!.lastUsedAt
    ).toBeNull();

    await startReauth(deps, contextHash, sessionHash);
    const reauth = await verifyReauth(deps, contextHash, sessionHash, {
      id: "credential-a",
    });
    sessionHash = hashOpaque(reauth.rawSession!);
    state = await deps.repo.transact(value => value);
    expect(
      state.passkeys.find(passkey => passkey.id === "credential-a")!.lastUsedAt
    ).toBe(clock.value);

    await deleteCredential(deps, sessionHash, "credential-b");
    await expect(
      deleteCredential(deps, sessionHash, "credential-a")
    ).rejects.toMatchObject({ code: "last_credential" });
  });
});
