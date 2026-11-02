import type {
  Clock,
  StateRepository,
  PilotState,
  StateRepositoryTarget,
} from "../ports/pilot";
import { pruneOperationalState } from "../domain/maintenance";
import { purgeExpiredEvidence } from "../domain/identity";
export function maintainedRepository(
  repo: StateRepository,
  clock: Clock
): StateRepository {
  const maintained: StateRepository = {
    target: repo.target as StateRepositoryTarget | undefined,
    transact: <T>(fn: (state: PilotState) => Promise<T> | T) =>
      repo.transact(state => {
        pruneOperationalState(state, clock.now());
        purgeExpiredEvidence(state, clock.now());
        return fn(state);
      }),
    close: () => repo.close?.() ?? Promise.resolve(),
  };
  return maintained;
}
