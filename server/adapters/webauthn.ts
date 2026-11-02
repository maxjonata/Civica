import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  Uint8Array_,
} from "@simplewebauthn/server";

export interface WebAuthnCredentialInput {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
}

export interface RegistrationVerification {
  verified: boolean;
  credential?: {
    id: string;
    publicKey: string;
    counter: number;
    transports: string[];
    deviceType: string;
    backedUp: boolean;
  };
}

export interface AuthenticationVerification {
  verified: boolean;
  credentialId?: string;
  newCounter?: number;
  deviceType?: string;
  backedUp?: boolean;
}

export interface WebauthnPort {
  registrationOptions(input: {
    rpID: string;
    userName: string;
    userID: Uint8Array;
    challenge: string;
    excludeCredentialIds?: string[];
  }): Promise<unknown>;
  authenticationOptions(input: {
    rpID: string;
    challenge: string;
  }): Promise<unknown>;
  verifyRegistration(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string[];
    rpID: string;
  }): Promise<RegistrationVerification>;
  verifyAuthentication(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string[];
    rpID: string;
    credential: WebAuthnCredentialInput;
  }): Promise<AuthenticationVerification>;
}

function encodePublicKey(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decodePublicKey(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64url")) as Uint8Array_;
}

function webauthnBytes(value: Uint8Array): Uint8Array_ {
  return value.slice() as Uint8Array_;
}

/** Production adapter; all protocol parsing and cryptographic checks stay in SimpleWebAuthn. */
export class RealWebauthnAdapter implements WebauthnPort {
  async registrationOptions(input: {
    rpID: string;
    userName: string;
    userID: Uint8Array;
    challenge: string;
    excludeCredentialIds?: string[];
  }): Promise<unknown> {
    return generateRegistrationOptions({
      rpName: "Cívica",
      rpID: input.rpID,
      userName: input.userName,
      userID: webauthnBytes(input.userID),
      challenge: input.challenge,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: (input.excludeCredentialIds ?? []).map(id => ({
        id,
      })),
    });
  }

  async authenticationOptions(input: {
    rpID: string;
    challenge: string;
  }): Promise<unknown> {
    return generateAuthenticationOptions({
      rpID: input.rpID,
      challenge: input.challenge,
      userVerification: "required",
    });
  }

  async verifyRegistration(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string[];
    rpID: string;
  }): Promise<RegistrationVerification> {
    try {
      const result = await verifyRegistrationResponse({
        response: input.response as RegistrationResponseJSON,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin: input.expectedOrigin,
        expectedRPID: input.rpID,
        requireUserVerification: true,
      });
      if (!result.verified) return { verified: false };
      return {
        verified: true,
        credential: {
          id: result.registrationInfo.credential.id,
          publicKey: encodePublicKey(
            result.registrationInfo.credential.publicKey
          ),
          counter: result.registrationInfo.credential.counter,
          transports: result.registrationInfo.credential.transports ?? [],
          deviceType: result.registrationInfo.credentialDeviceType,
          backedUp: result.registrationInfo.credentialBackedUp,
        },
      };
    } catch {
      return { verified: false };
    }
  }

  async verifyAuthentication(input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string[];
    rpID: string;
    credential: WebAuthnCredentialInput;
  }): Promise<AuthenticationVerification> {
    try {
      const result = await verifyAuthenticationResponse({
        response: input.response as AuthenticationResponseJSON,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin: input.expectedOrigin,
        expectedRPID: input.rpID,
        credential: {
          id: input.credential.id,
          publicKey: webauthnBytes(decodePublicKey(input.credential.publicKey)),
          counter: input.credential.counter,
          transports: input.credential.transports,
        },
        requireUserVerification: true,
      });
      return {
        verified: result.verified,
        credentialId: result.authenticationInfo.credentialID,
        newCounter: result.authenticationInfo.newCounter,
        deviceType: result.authenticationInfo.credentialDeviceType,
        backedUp: result.authenticationInfo.credentialBackedUp,
      };
    } catch {
      return { verified: false };
    }
  }
}

export { decodePublicKey, encodePublicKey };
