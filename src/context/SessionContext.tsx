import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Demographics, WorkloadResponse, IPCResponse } from '../types';

// ── In-progress assessment ────────────────────────────────────────────────
// The answers a nurse is part-way through are held in memory for the length of
// the sitting and then written to the database as one record. They are never
// mirrored to localStorage: a half-finished questionnaire is not study data,
// and leaving one behind on a shared ward device is exactly what the ethics
// protocol's "no participant data at rest on the device" clause rules out.
//
// Closing or reloading the tab therefore discards a part-finished sitting.
// That is deliberate — the questionnaire takes about seven minutes.

export interface DraftSession {
  demographics: Partial<Demographics>;
  workloadResponses: WorkloadResponse;
  ipcResponses: IPCResponse;
}

const EMPTY: DraftSession = {
  demographics: {},
  workloadResponses: {},
  ipcResponses: {},
};

interface SessionContextValue {
  session: DraftSession;
  setDemographics: (d: Partial<Demographics>) => void;
  setWorkloadResponses: (r: WorkloadResponse) => void;
  setIPCResponses: (r: IPCResponse) => void;
  resetSession: () => void;
  /** True once the intake form has been completed for this sitting. */
  hasParticipant: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DraftSession>(EMPTY);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    setDemographics: d =>
      setSession(s => ({ ...s, demographics: d })),
    setWorkloadResponses: r =>
      setSession(s => ({ ...s, workloadResponses: r })),
    setIPCResponses: r =>
      setSession(s => ({ ...s, ipcResponses: r })),
    resetSession: () => setSession(EMPTY),
    hasParticipant: Boolean(session.demographics.nurseCode && session.demographics.ward),
  }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
