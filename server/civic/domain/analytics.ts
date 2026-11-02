import type { PublicVoteResult, VoteChoice } from "@shared/civic/contracts";
import type { PublicCell, RegionCell, VoteRecord } from "./types";

export type VoteCounts = Record<VoteChoice, number>;

export function publicVoteResultFromCounts(
  counts: VoteCounts,
  minimumSample = 10
): PublicVoteResult {
  const safeCounts: VoteCounts = {
    support: Math.max(0, Math.floor(counts.support)),
    oppose: Math.max(0, Math.floor(counts.oppose)),
    need_information: Math.max(0, Math.floor(counts.need_information)),
  };
  const total = safeCounts.support + safeCounts.oppose + safeCounts.need_information;
  if (total < minimumSample) {
    return { visible: false, reason: "minimum_sample", minimumSample, total: null, choices: null };
  }
  if (Object.values(safeCounts).some(count => count > 0 && count < minimumSample)) {
    return { visible: false, reason: "small_choice_cell", minimumSample, total: null, choices: null };
  }
  return { visible: true, reason: null, minimumSample, total, choices: safeCounts };
}

export function publicVoteResult(
  votes: readonly (VoteChoice | VoteRecord)[],
  minimumSample = 10
): PublicVoteResult {
  const counts: VoteCounts = { support: 0, oppose: 0, need_information: 0 };
  for (const vote of votes) {
    const choice = typeof vote === "string" ? vote : vote.choice;
    if (choice in counts) counts[choice] += 1;
  }
  return publicVoteResultFromCounts(counts, minimumSample);
}

export function suppressSmallCells(
  cells: readonly RegionCell[],
  minimumSample = 10
): PublicCell[] {
  const result = cells.map(({ key, count }) => ({
    key,
    count: count < minimumSample ? null : count,
    suppressed: count < minimumSample,
  }));
  const hidden = result.filter(cell => cell.suppressed);
  if (hidden.length === 1 && result.length > 1) {
    const complementary = result
      .filter(cell => !cell.suppressed)
      .sort((a, b) => (a.count ?? 0) - (b.count ?? 0) || a.key.localeCompare(b.key))[0];
    if (complementary) {
      complementary.count = null;
      complementary.suppressed = true;
    }
  }
  return result;
}
