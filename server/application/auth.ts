import { createHash } from "node:crypto";
import { z } from "zod";
import type { CredentialView, SessionView } from "../../shared/pilot";
import {
  PilotError,
  type Account,
  type AuthChallenge,
  type BrowserContext,
  type Clock,
  type Passkey,
  type RandomSource,
  type RuntimeConfig,
  type Session,
  type StateRepository,
} from "../ports/pilot";
import { enforceRate, requireAccount } from "../domain/security";
import type {
  AuthenticationVerification,
  RegistrationVerification,
  WebauthnPort,
} from "../adapters/webauthn";

export type { WebauthnPort } from "../adapters/webauthn";

export const CONTEXT_LIFETIME_MS = 2 * 60 * 60 * 1000;
export const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
export const INVITE_LIFETIME_MS = 24 * 60 * 60 * 1000;

const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{N} .,'’_-]+$/u);
const labelSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{N} .,'’_-]+$/u);

export interface AuthDependencies {
  repo: StateRepository;
  config: RuntimeConfig;
  clock: Clock;
  random: RandomSource;
  webauthn: WebauthnPort;
}

export interface SessionTokens {
  rawContext: string;
  rawSession?: string;
}

export interface AuthResult extends SessionTokens {
  account: Account;
}

export interface RegistrationOptionsInput {
  contextHash: string;
  nickname: string;
  invite: string;
}

export interface CredentialOptionsInput {
  contextHash: string;
  sessionHash: string;
  label: string;
}

function fail(code: string, status = 400): never {
  throw new PilotError(code, status);
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length > 64 * 1024) fail(code);
  return value;
}

function validNickname(value: unknown): string {
  const parsed = nicknameSchema.safeParse(value);
  if (!parsed.success) fail("invalid_nickname");
  return parsed.data;
}

function validLabel(value: unknown): string {
  const parsed = labelSchema.safeParse(value);
  if (!parsed.success) fail("invalid_label");
  return parsed.data;
}

function contextOrFail(
  state: Parameters<Parameters<StateRepository["transact"]>[0]>[0],
  contextHash: string,
  now: number
): BrowserContext {
  const context = state.contexts.find(
    candidate => candidate.hash === contextHash
  );
  if (!context || context.expiresAt <= now) fail("context_invalid", 403);
  return context;
}

function challengeOrFail(
  state: Parameters<Parameters<StateRepository["transact"]>[0]>[0],
  contextHash: string,
  kind: AuthChallenge["kind"],
  now: number
): AuthChallenge {
  const challenge = state.challenges.find(
    candidate =>
      candidate.contextHash === contextHash &&
      candidate.kind === kind &&
      candidate.usedAt === null
  );
  if (!challenge || challenge.expiresAt <= now) fail("challenge_invalid");
  challenge.usedAt = now;
  return challenge;
}

function newContext(
  state: Parameters<Parameters<StateRepository["transact"]>[0]>[0],
  now: number,
  random: RandomSource
): { context: BrowserContext; raw: string } {
  const raw = random.token(32);
  const context = {
    hash: hashOpaque(raw),
    csrf: random.token(32),
    expiresAt: now + CONTEXT_LIFETIME_MS,
  };
  state.contexts.push(context);
  return { context, raw };
}

function rotateContext(
  state: Parameters<Parameters<StateRepository["transact"]>[0]>[0],
  oldHash: string,
  now: number,
  random: RandomSource
): { context: BrowserContext; raw: string } {
  state.contexts = state.contexts.filter(context => context.hash !== oldHash);
  return newContext(state, now, random);
}

function responseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function unwrapWebAuthnResponse(value: unknown): unknown {
  const object = responseObject(value);
  if (
    object &&
    typeof object.id === "string" &&
    typeof object.type === "string"
  )
    return value;
  if (object && object.response && typeof object.response === "object")
    return object.response;
  return value;
}

function responseCredentialId(value: unknown): string | null {
  const object = responseObject(unwrapWebAuthnResponse(value));
  return object && typeof object.id === "string" ? object.id : null;
}

function challengeValue(challenge: AuthChallenge): string {
  const options = responseObject(challenge.options);
  if (!options || typeof options.challenge !== "string")
    fail("challenge_invalid");
  return options.challenge;
}

function credentialFor(passkey: Passkey): {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
} {
  return {
    id: passkey.id,
    publicKey: passkey.publicKey,
    counter: passkey.counter,
    transports: passkey.transports,
  };
}

function credentialFromVerification(
  value: RegistrationVerification["credential"]
): Passkey {
  if (!value) fail("webauthn_verification_failed");
  return {
    id: value.id,
    accountId: "",
    label: "",
    publicKey: value.publicKey,
    counter: value.counter,
    transports: value.transports,
    deviceType: value.deviceType,
    backedUp: value.backedUp,
    createdAt: 0,
    lastUsedAt: null,
  };
}

function ensureVerification(
  result: RegistrationVerification | AuthenticationVerification
): void {
  if (!result.verified) fail("webauthn_verification_failed");
}

export async function issueInvite(
  repo: StateRepository,
  clock: Clock,
  random: RandomSource,
  expiresInMs = INVITE_LIFETIME_MS
): Promise<string> {
  const raw = random.token(32);
  await repo.transact(state => {
    state.invites.push({
      hash: hashOpaque(raw),
      expiresAt: clock.now() + expiresInMs,
      usedAt: null,
      accountId: null,
    });
  });
  return raw;
}

export async function startRegistration(
  deps: AuthDependencies,
  input: RegistrationOptionsInput
): Promise<unknown> {
  if (!deps.config.configured) fail("site_not_configured", 503);
  const nickname = validNickname(input.nickname);
  const invite = text(input.invite, "invalid_invite");
  const inviteHash = hashOpaque(invite);
  const challengeToken = deps.random.token(32);
  const pendingAccountId = deps.random.token(16);
  const userID = Uint8Array.from(Buffer.from(pendingAccountId, "utf8"));
  const preparation = await deps.repo.transact(state => {
    contextOrFail(state, input.contextHash, deps.clock.now());
    enforceRate(
      state,
      `register:${input.contextHash}`,
      deps.clock.now(),
      5,
      CHALLENGE_LIFETIME_MS
    );
    if (state.accounts.length >= deps.config.maxAccounts)
      fail("account_limit", 409);
    const invitation = state.invites.find(
      candidate => candidate.hash === inviteHash
    );
    if (
      !invitation ||
      invitation.usedAt !== null ||
      invitation.expiresAt <= deps.clock.now()
    )
      fail("invite_invalid", 403);
    return [] as string[];
  });
  const options = await deps.webauthn.registrationOptions({
    rpID: deps.config.rpID,
    userName: nickname,
    userID,
    challenge: challengeToken,
    excludeCredentialIds: preparation,
  });
  await deps.repo.transact(state => {
    contextOrFail(state, input.contextHash, deps.clock.now());
    const invitation = state.invites.find(
      candidate => candidate.hash === inviteHash
    );
    if (
      !invitation ||
      invitation.usedAt !== null ||
      invitation.expiresAt <= deps.clock.now()
    )
      fail("invite_invalid", 403);
    for (const old of state.challenges)
      if (
        old.contextHash === input.contextHash &&
        old.kind === "register" &&
        old.usedAt === null
      )
        old.usedAt = deps.clock.now();
    state.challenges.push({
      id: deps.random.token(16),
      contextHash: input.contextHash,
      kind: "register",
      accountId: pendingAccountId,
      options,
      nickname,
      inviteHash,
      expiresAt: deps.clock.now() + CHALLENGE_LIFETIME_MS,
      usedAt: null,
    });
  });
  return options;
}

export async function startLogin(
  deps: AuthDependencies,
  contextHash: string
): Promise<unknown> {
  if (!deps.config.configured) fail("site_not_configured", 503);
  const challengeToken = deps.random.token(32);
  await deps.repo.transact(state => {
    contextOrFail(state, contextHash, deps.clock.now());
    enforceRate(
      state,
      `login:${contextHash}`,
      deps.clock.now(),
      10,
      CHALLENGE_LIFETIME_MS
    );
  });
  const options = await deps.webauthn.authenticationOptions({
    rpID: deps.config.rpID,
    challenge: challengeToken,
  });
  await deps.repo.transact(state => {
    contextOrFail(state, contextHash, deps.clock.now());
    for (const old of state.challenges)
      if (
        old.contextHash === contextHash &&
        old.kind === "login" &&
        old.usedAt === null
      )
        old.usedAt = deps.clock.now();
    state.challenges.push({
      id: deps.random.token(16),
      contextHash,
      kind: "login",
      accountId: null,
      options,
      expiresAt: deps.clock.now() + CHALLENGE_LIFETIME_MS,
      usedAt: null,
    });
  });
  return options;
}

export async function startReauth(
  deps: AuthDependencies,
  contextHash: string,
  sessionHash: string
): Promise<unknown> {
  if (!deps.config.configured) fail("site_not_configured", 503);
  const challengeToken = deps.random.token(32);
  await deps.repo.transact(state => {
    contextOrFail(state, contextHash, deps.clock.now());
    const { account } = requireAccount(
      state,
      sessionHash,
      deps.clock.now(),
      deps.config
    );
    enforceRate(
      state,
      `reauth:${account.id}`,
      deps.clock.now(),
      10,
      CHALLENGE_LIFETIME_MS
    );
  });
  const options = await deps.webauthn.authenticationOptions({
    rpID: deps.config.rpID,
    challenge: challengeToken,
  });
  await deps.repo.transact(state => {
    const { account } = requireAccount(
      state,
      sessionHash,
      deps.clock.now(),
      deps.config
    );
    contextOrFail(state, contextHash, deps.clock.now());
    for (const old of state.challenges)
      if (
        old.contextHash === contextHash &&
        old.kind === "reauth" &&
        old.usedAt === null
      )
        old.usedAt = deps.clock.now();
    state.challenges.push({
      id: deps.random.token(16),
      contextHash,
      kind: "reauth",
      accountId: account.id,
      options,
      expiresAt: deps.clock.now() + CHALLENGE_LIFETIME_MS,
      usedAt: null,
    });
  });
  return options;
}

export async function startCredentialAdd(
  deps: AuthDependencies,
  input: CredentialOptionsInput
): Promise<unknown> {
  if (!deps.config.configured) fail("site_not_configured", 503);
  const label = validLabel(input.label);
  const challengeToken = deps.random.token(32);
  const preparation = await deps.repo.transact(state => {
    contextOrFail(state, input.contextHash, deps.clock.now());
    const { account } = requireAccount(
      state,
      input.sessionHash,
      deps.clock.now(),
      deps.config,
      { recent: true }
    );
    enforceRate(
      state,
      `credential-add:${account.id}`,
      deps.clock.now(),
      10,
      CHALLENGE_LIFETIME_MS
    );
    return {
      accountId: account.id,
      excludeCredentialIds: state.passkeys
        .filter(passkey => passkey.accountId === account.id)
        .map(passkey => passkey.id),
    };
  });
  const options = await deps.webauthn.registrationOptions({
    rpID: deps.config.rpID,
    userName: preparation.accountId,
    userID: Uint8Array.from(Buffer.from(preparation.accountId, "utf8")),
    challenge: challengeToken,
    excludeCredentialIds: preparation.excludeCredentialIds,
  });
  await deps.repo.transact(state => {
    requireAccount(state, input.sessionHash, deps.clock.now(), deps.config, {
      recent: true,
    });
    contextOrFail(state, input.contextHash, deps.clock.now());
    for (const old of state.challenges)
      if (
        old.contextHash === input.contextHash &&
        old.kind === "add" &&
        old.usedAt === null
      )
        old.usedAt = deps.clock.now();
    state.challenges.push({
      id: deps.random.token(16),
      contextHash: input.contextHash,
      kind: "add",
      accountId: preparation.accountId,
      options,
      label,
      expiresAt: deps.clock.now() + CHALLENGE_LIFETIME_MS,
      usedAt: null,
    });
  });
  return options;
}

async function consumeChallenge(
  deps: AuthDependencies,
  contextHash: string,
  kind: AuthChallenge["kind"]
): Promise<AuthChallenge> {
  return deps.repo.transact(state => {
    contextOrFail(state, contextHash, deps.clock.now());
    const challenge = challengeOrFail(
      state,
      contextHash,
      kind,
      deps.clock.now()
    );
    return challenge;
  });
}

async function verifyRegistrationWithAdapter(
  deps: AuthDependencies,
  challenge: AuthChallenge,
  response: unknown
): Promise<RegistrationVerification> {
  try {
    return await deps.webauthn.verifyRegistration({
      response: unwrapWebAuthnResponse(response),
      expectedChallenge: challengeValue(challenge),
      expectedOrigin: deps.config.origins,
      rpID: deps.config.rpID,
    });
  } catch {
    return { verified: false };
  }
}

export async function verifyRegistration(
  deps: AuthDependencies,
  contextHash: string,
  response: unknown
): Promise<AuthResult> {
  const challenge = await consumeChallenge(deps, contextHash, "register");
  const result = await verifyRegistrationWithAdapter(deps, challenge, response);
  ensureVerification(result);
  const credential = credentialFromVerification(result.credential);
  return deps.repo.transact(state => {
    contextOrFail(state, contextHash, deps.clock.now());
    if (state.accounts.length >= deps.config.maxAccounts)
      fail("account_limit", 409);
    const invitation = state.invites.find(
      candidate => candidate.hash === challenge.inviteHash
    );
    if (
      !invitation ||
      invitation.usedAt !== null ||
      invitation.expiresAt <= deps.clock.now()
    )
      fail("invite_invalid", 403);
    if (state.passkeys.some(passkey => passkey.id === credential.id))
      fail("credential_exists", 409);
    if (
      !challenge.accountId ||
      state.accounts.some(candidate => candidate.id === challenge.accountId)
    )
      fail("challenge_invalid");
    const account: Account = {
      id: challenge.accountId,
      nickname: challenge.nickname ?? "",
      role: "member",
      createdAt: deps.clock.now(),
    };
    credential.accountId = account.id;
    credential.label = "Chave principal";
    credential.createdAt = deps.clock.now();
    state.accounts.push(account);
    state.passkeys.push(credential);
    invitation.usedAt = deps.clock.now();
    invitation.accountId = account.id;
    const rotated = rotateContext(
      state,
      contextHash,
      deps.clock.now(),
      deps.random
    );
    const rawSession = deps.random.token(32);
    state.sessions.push({
      hash: hashOpaque(rawSession),
      accountId: account.id,
      credentialId: credential.id,
      authAt: deps.clock.now(),
      createdAt: deps.clock.now(),
      lastSeenAt: deps.clock.now(),
      expiresAt: deps.clock.now() + deps.config.sessionLifetimeMs,
      revokedAt: null,
    });
    return { account, rawContext: rotated.raw, rawSession };
  });
}

async function verifyAuthentication(
  deps: AuthDependencies,
  challenge: AuthChallenge,
  response: unknown,
  expectedAccountId: string | null
): Promise<{ result: AuthenticationVerification; passkey: Passkey }> {
  const id = responseCredentialId(response);
  if (!id) fail("credential_unknown");
  const passkey = await deps.repo.transact(state => {
    const value = state.passkeys.find(
      candidate =>
        candidate.id === id &&
        (!expectedAccountId || candidate.accountId === expectedAccountId)
    );
    if (!value) fail("credential_unknown");
    return value;
  });
  let result: AuthenticationVerification;
  try {
    result = await deps.webauthn.verifyAuthentication({
      response: unwrapWebAuthnResponse(response),
      expectedChallenge: challengeValue(challenge),
      expectedOrigin: deps.config.origins,
      rpID: deps.config.rpID,
      credential: credentialFor(passkey),
    });
  } catch {
    result = { verified: false };
  }
  ensureVerification(result);
  if (result.credentialId && result.credentialId !== passkey.id)
    fail("credential_unknown");
  return { result, passkey };
}

function applyCounter(passkey: Passkey, newCounter: number | undefined): void {
  if (
    typeof newCounter !== "number" ||
    !Number.isSafeInteger(newCounter) ||
    newCounter < 0
  )
    fail("counter_invalid");
  if (passkey.counter > 0 && newCounter > 0 && newCounter <= passkey.counter)
    fail("counter_replay");
  passkey.counter = Math.max(passkey.counter, newCounter);
}

export async function verifyLogin(
  deps: AuthDependencies,
  contextHash: string,
  response: unknown
): Promise<AuthResult> {
  const challenge = await consumeChallenge(deps, contextHash, "login");
  const { result, passkey } = await verifyAuthentication(
    deps,
    challenge,
    response,
    null
  );
  return deps.repo.transact(state => {
    contextOrFail(state, contextHash, deps.clock.now());
    const current = state.passkeys.find(
      candidate => candidate.id === passkey.id
    );
    if (!current) fail("credential_unknown");
    applyCounter(current, result.newCounter);
    current.lastUsedAt = deps.clock.now();
    const account = state.accounts.find(
      candidate => candidate.id === current.accountId
    );
    if (!account) fail("credential_unknown");
    const rotated = rotateContext(
      state,
      contextHash,
      deps.clock.now(),
      deps.random
    );
    const rawSession = deps.random.token(32);
    state.sessions.push({
      hash: hashOpaque(rawSession),
      accountId: account.id,
      credentialId: current.id,
      authAt: deps.clock.now(),
      createdAt: deps.clock.now(),
      lastSeenAt: deps.clock.now(),
      expiresAt: deps.clock.now() + deps.config.sessionLifetimeMs,
      revokedAt: null,
    });
    return { account, rawContext: rotated.raw, rawSession };
  });
}

export async function verifyReauth(
  deps: AuthDependencies,
  contextHash: string,
  sessionHash: string,
  response: unknown
): Promise<AuthResult> {
  const challenge = await consumeChallenge(deps, contextHash, "reauth");
  const { result, passkey } = await verifyAuthentication(
    deps,
    challenge,
    response,
    challenge.accountId
  );
  return deps.repo.transact(state => {
    const { account, session } = requireAccount(
      state,
      sessionHash,
      deps.clock.now(),
      deps.config
    );
    if (account.id !== challenge.accountId || passkey.accountId !== account.id)
      fail("authorization_denied", 403);
    const current = state.passkeys.find(
      candidate => candidate.id === passkey.id
    );
    if (!current) fail("credential_unknown");
    applyCounter(current, result.newCounter);
    current.lastUsedAt = deps.clock.now();
    session.revokedAt = deps.clock.now();
    const rawSession = deps.random.token(32);
    state.sessions.push({
      hash: hashOpaque(rawSession),
      accountId: account.id,
      credentialId: current.id,
      authAt: deps.clock.now(),
      createdAt: deps.clock.now(),
      lastSeenAt: deps.clock.now(),
      expiresAt: deps.clock.now() + deps.config.sessionLifetimeMs,
      revokedAt: null,
    });
    return { account, rawContext: "", rawSession };
  });
}

export async function verifyCredentialAdd(
  deps: AuthDependencies,
  contextHash: string,
  sessionHash: string,
  response: unknown
): Promise<Account> {
  const challenge = await consumeChallenge(deps, contextHash, "add");
  const result = await verifyRegistrationWithAdapter(deps, challenge, response);
  ensureVerification(result);
  const credential = credentialFromVerification(result.credential);
  return deps.repo.transact(state => {
    const { account } = requireAccount(
      state,
      sessionHash,
      deps.clock.now(),
      deps.config,
      { recent: true }
    );
    if (account.id !== challenge.accountId) fail("authorization_denied", 403);
    if (state.passkeys.some(passkey => passkey.id === credential.id))
      fail("credential_exists", 409);
    credential.accountId = account.id;
    credential.label = challenge.label ?? "Chave adicional";
    credential.createdAt = deps.clock.now();
    credential.lastUsedAt = null;
    state.passkeys.push(credential);
    return account;
  });
}

export async function logout(
  deps: AuthDependencies,
  sessionHash: string | null
): Promise<void> {
  if (!sessionHash) return;
  await deps.repo.transact(state => {
    const session = state.sessions.find(
      candidate =>
        candidate.hash === sessionHash && candidate.revokedAt === null
    );
    if (session) session.revokedAt = deps.clock.now();
  });
}

export async function deleteCredential(
  deps: AuthDependencies,
  sessionHash: string,
  credentialId: string
): Promise<{ account: Account; revokedCurrentSession: boolean }> {
  return deps.repo.transact(state => {
    const { account, session } = requireAccount(
      state,
      sessionHash,
      deps.clock.now(),
      deps.config,
      { recent: true }
    );
    const owned = state.passkeys.filter(
      passkey => passkey.accountId === account.id
    );
    const credential = owned.find(passkey => passkey.id === credentialId);
    if (!credential) fail("credential_not_found", 404);
    if (owned.length <= 1) fail("last_credential", 409);
    if (
      state.enrollments.some(
        enrollment =>
          enrollment.accountId === account.id &&
          enrollment.credentialId === credentialId &&
          enrollment.status !== "rejected"
      )
    ) {
      fail("credential_bound", 409);
    }
    state.passkeys = state.passkeys.filter(
      passkey => passkey.id !== credentialId
    );
    const revokedCurrentSession = session.credentialId === credentialId;
    for (const candidate of state.sessions)
      if (
        candidate.accountId === account.id &&
        candidate.credentialId === credentialId &&
        candidate.revokedAt === null
      )
        candidate.revokedAt = deps.clock.now();
    return { account, revokedCurrentSession };
  });
}
import { identityView } from "../domain/identity";

export async function getSessionView(
  deps: AuthDependencies,
  contextHash: string | null,
  sessionHash: string | null,
  getProtectionStatus: () => {
    documentProtectionReady: boolean;
    cpfUniquenessReady: boolean;
  }
): Promise<{ view: SessionView; rawContext?: string }> {
  return deps.repo.transact(state => {
    let context = contextHash
      ? state.contexts.find(
          candidate =>
            candidate.hash === contextHash &&
            candidate.expiresAt > deps.clock.now()
        )
      : undefined;
    let rawContext: string | undefined;
    if (!context) {
      enforceRate(state, "context:new:global", deps.clock.now(), 70, 60000);
      const created = newContext(state, deps.clock.now(), deps.random);
      context = created.context;
      rawContext = created.raw;
    }

    let account: Account | null = null;
    let currentSession: Session | null = null;
    if (sessionHash) {
      const candidate = state.sessions.find(
        session => session.hash === sessionHash && session.revokedAt === null
      );
      if (
        candidate &&
        candidate.expiresAt > deps.clock.now() &&
        deps.clock.now() - candidate.lastSeenAt <= deps.config.sessionIdleMs
      ) {
        const found = state.accounts.find(
          value => value.id === candidate.accountId
        );
        if (found) {
          account = found;
          currentSession = candidate;
          currentSession.lastSeenAt = deps.clock.now();
        }
      }
    }

    const credentials: CredentialView[] = account
      ? state.passkeys
          .filter(passkey => passkey.accountId === account!.id)
          .map(passkey => ({
            id: passkey.id,
            label: passkey.label,
            createdAt: passkey.createdAt,
            lastUsedAt: passkey.lastUsedAt,
            isCurrent: passkey.id === currentSession?.credentialId,
            boundToDocument: state.enrollments.some(
              enrollment =>
                enrollment.accountId === account!.id &&
                enrollment.credentialId === passkey.id &&
                enrollment.status !== "rejected"
            ),
          }))
      : [];
    const enrollment = account
      ? [...state.enrollments]
          .reverse()
          .find(value => value.accountId === account!.id)
      : undefined;
    const protection = getProtectionStatus();
    return {
      view: {
        account: account
          ? {
              id: account.id,
              nickname: account.nickname,
              role: account.role,
              createdAt: account.createdAt,
            }
          : null,
        credentials,
        csrfToken: context!.csrf,
        recentAuth: Boolean(
          currentSession &&
            deps.clock.now() - currentSession.authAt <= deps.config.recentAuthMs
        ),
        identity: enrollment ? identityView(enrollment) : null,
        configuration: {
          ready: deps.config.configured,
          origin: deps.config.primaryOrigin,
          rpID: deps.config.rpID,
          documentProtectionReady: protection.documentProtectionReady,
          cpfUniquenessReady: protection.cpfUniquenessReady,
          requiresInvite: true,
          maxPdfBytes: 2 * 1024 * 1024,
        },
      },
      rawContext,
    };
  });
}
