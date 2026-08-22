import { useEffect, useState } from 'react';
import { subscribeToRecords, analysable, type RecordsSnapshot } from '../utils/records';
import { firebaseConfigured } from '../lib/firebase';
import type { AssessmentRecord } from '../types';

export interface RecordsState {
  /** Everything in the collection, newest first — including excluded records. */
  all: AssessmentRecord[];
  /** The analysis set: excluded records removed. */
  records: AssessmentRecord[];
  loading: boolean;
  error: string | null;
  pendingWrites: boolean;
  fromCache: boolean;
  configured: boolean;
}

/**
 * Live view of the study database. There is no local copy to reconcile: the
 * component re-renders whenever the collection changes, on any device.
 */
export function useRecords(): RecordsState {
  const [state, setState] = useState<RecordsState>({
    all: [],
    records: [],
    loading: firebaseConfigured,
    error: firebaseConfigured ? null : 'Study database is not configured.',
    pendingWrites: false,
    fromCache: false,
    configured: firebaseConfigured,
  });

  useEffect(() => {
    if (!firebaseConfigured) return;

    const unsubscribe = subscribeToRecords(
      (snap: RecordsSnapshot) => {
        setState({
          all: snap.records,
          records: analysable(snap.records),
          loading: false,
          error: null,
          pendingWrites: snap.pendingWrites,
          fromCache: snap.fromCache,
          configured: true,
        });
      },
      err => {
        setState(s => ({ ...s, loading: false, error: err.message }));
      },
    );

    return unsubscribe;
  }, []);

  return state;
}
