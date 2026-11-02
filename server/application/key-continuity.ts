import {
  PilotError,
  type StateRepository,
  type CryptoPort,
} from "../ports/pilot";
export async function ensureProtectionContinuity(
  repo: StateRepository,
  crypto: CryptoPort
): Promise<void> {
  await repo.transact(state => {
    const prior = state.cryptoFingerprints ?? { document: null, cpf: null };
    const current = crypto.fingerprints;
    if (!prior.cpf && state.enrollments.some(e => e.cpfIndex !== null))
      throw new PilotError("KEY_ROTATION_REQUIRES_MIGRATION", 503);
    for (const kind of ["document", "cpf"] as const) {
      if (prior[kind] && !current[kind])
        throw new PilotError("PROTECTION_KEY_MISSING", 503);
      if (prior[kind] && prior[kind] !== current[kind])
        throw new PilotError("KEY_ROTATION_REQUIRES_MIGRATION", 503);
    }
    state.cryptoFingerprints = {
      document: current.document ?? prior.document,
      cpf: current.cpf ?? prior.cpf,
    };
  });
}
