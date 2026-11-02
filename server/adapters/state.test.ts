import { describe, expect, it } from "vitest";
import { MemoryStateRepository } from "./state";
import { emptyState, type PilotState } from "../ports/pilot";

function accountState(): PilotState {
  const state = emptyState();
  state.accounts.push({
    id: "account-1",
    nickname: "Pessoa",
    role: "member",
    createdAt: 1,
  });
  return state;
}

describe("MemoryStateRepository", () => {
  it("commits a deep-cloned result and never leaks mutable state", async () => {
    const repo = new MemoryStateRepository(accountState());
    const result = await repo.transact(state => {
      state.accounts[0]!.nickname = "Atualizado";
      return state.accounts[0]!;
    });

    result.nickname = "mutado fora da transação";
    const snapshot = await repo.transact(state => state);

    expect(snapshot.accounts[0]!.nickname).toBe("Atualizado");
    expect(snapshot).not.toBe(accountState());
  });

  it("rolls back state when the callback throws", async () => {
    const repo = new MemoryStateRepository(accountState());

    await expect(
      repo.transact(state => {
        state.accounts[0]!.nickname = "não commitado";
        throw new Error("falha controlada");
      })
    ).rejects.toThrow("falha controlada");

    await expect(
      repo.transact(state => state.accounts[0]!.nickname)
    ).resolves.toBe("Pessoa");
  });

  it("serializes concurrent callbacks without lost updates", async () => {
    const repo = new MemoryStateRepository(emptyState());
    await Promise.all(
      Array.from({ length: 32 }, (_, index) =>
        repo.transact(async state => {
          await new Promise(resolve => setTimeout(resolve, index % 3));
          state.rates.push({ key: `k-${index}`, start: index, count: 1 });
        })
      )
    );

    await expect(repo.transact(state => state.rates.length)).resolves.toBe(32);
  });

  it("rejects a serialized snapshot larger than 8 MiB", async () => {
    const repo = new MemoryStateRepository();
    await expect(
      repo.transact(state => {
        state.accounts.push({
          id: "large",
          nickname: "x".repeat(8 * 1024 * 1024),
          role: "member",
          createdAt: 1,
        });
      })
    ).rejects.toMatchObject({ code: "STATE_TOO_LARGE" });
  });
});
