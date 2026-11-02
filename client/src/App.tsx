import CivicApp from "./civic/CivicApp";
import type { SessionView } from "@shared/pilot";
import { ApiError } from "./lib/api";

type LegacySessionContext = {
  session: SessionView | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

export function useAppSession(): LegacySessionContext {
  return {
    session: null,
    loading: false,
    error: null,
    refresh: async () => undefined,
    logout: async () => undefined,
  };
}

export default function App() {
  return <CivicApp />;
}
