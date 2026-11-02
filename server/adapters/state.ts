import {
  emptyState,
  type PilotState,
  type StateRepository,
  type StateRepositoryTarget,
} from "../ports/pilot";

export const MAX_STATE_BYTES = 8 * 1024 * 1024;
export const STATE_TOO_LARGE = "STATE_TOO_LARGE";

export class StateTooLargeError extends Error {
  readonly code = STATE_TOO_LARGE;

  constructor() {
    super(STATE_TOO_LARGE);
    this.name = "StateTooLargeError";
  }
}

export function serializePilotState(state: PilotState): string {
  const serialized = JSON.stringify(state);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES)
    throw new StateTooLargeError();
  return serialized;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** In-memory repository for isolated tests only; production uses MysqlStateRepository. */
export class MemoryStateRepository implements StateRepository {
  readonly target: StateRepositoryTarget = Object.freeze({
    kind: "testmemory" as const,
  });
  private state: PilotState;
  private tail: Promise<void> = Promise.resolve();

  constructor(initial: PilotState = emptyState()) {
    this.state = clone(initial);
    serializePilotState(this.state);
  }

  async transact<T>(
    operation: (state: PilotState) => Promise<T> | T
  ): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;

    try {
      const working = clone(this.state);
      const result = await operation(working);
      const committed = clone(working);
      serializePilotState(committed);
      this.state = committed;
      return clone(result);
    } finally {
      release();
    }
  }
}
