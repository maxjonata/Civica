export type LegislativeSearchState<T> =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "empty" }
  | { type: "results"; matches: T[] };

export function resolveLegislativeSearchState<T>(input: {
  searched: boolean;
  loading: boolean;
  error: string | null;
  matches: T[];
}): LegislativeSearchState<T> {
  if (input.loading) return { type: "loading" };
  if (input.error) return { type: "error", message: input.error };
  if (!input.searched) return { type: "idle" };
  if (input.matches.length === 0) return { type: "empty" };
  return { type: "results", matches: input.matches };
}
