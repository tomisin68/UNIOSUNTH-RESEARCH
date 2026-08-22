import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db, firebaseConfigured, RECORDS_COLLECTION } from '../lib/firebase';
import type { AssessmentRecord } from '../types';

// ── Single source of truth ────────────────────────────────────────────────
// Every completed assessment lives in Firestore and nowhere else. The app
// keeps no copy of the study data in localStorage: what the Data and Analysis
// tabs show is a live view of the collection.
//
// Offline is handled by the Firestore SDK's own IndexedDB write queue
// (configured in lib/firebase.ts), not by a queue of our own. A write made
// with no connection is durably recorded by the SDK and replayed on
// reconnect — including after a full page reload — so `submitRecord` reports
// 'pending' rather than 'failed' when the server does not acknowledge in time.

const WRITE_ACK_TIMEOUT_MS = 12_000;

export type SubmitOutcome = 'confirmed' | 'pending';

export class DatabaseUnavailableError extends Error {
  constructor() {
    super('Study database is not configured — add Firebase credentials to .env');
    this.name = 'DatabaseUnavailableError';
  }
}

function requireDb() {
  if (!firebaseConfigured || !db) throw new DatabaseUnavailableError();
  return db;
}

// ── Document mapping ──────────────────────────────────────────────────────

// The security rules reject empty strings, so every text field gets a fallback.
function str(value: unknown, fallback = 'unspecified'): string {
  const s = value == null ? '' : String(value).trim();
  return s === '' ? fallback : s;
}

function toDocument(record: AssessmentRecord): DocumentData {
  const submittedOn = str(record.timestamp, new Date().toISOString());
  return {
    id: record.id,
    nurseCode: str(record.demographics.nurseCode, 'UNKNOWN'),
    ward: str(record.demographics.ward),
    shift: record.demographics.shift,
    qualification: record.demographics.qualification,
    yearsExperience: str(record.demographics.yearsExperience),
    patientLoad: str(record.demographics.patientLoad),
    assessmentDate: str(record.demographics.date, submittedOn),
    timestamp: submittedOn,
    workloadScore: record.workloadScore,
    ipcScore: record.ipcScore,
    workloadCategory: record.workloadCategory,
    ipcCategory: record.ipcCategory,
    subscoreWorkload: record.subscoreWorkload ?? {},
    subscoreIPC: record.subscoreIPC ?? {},
    workloadResponses: record.workloadResponses ?? {},
    ipcResponses: record.ipcResponses ?? {},
    excluded: record.excluded ?? false,
    submittedAt: serverTimestamp(),
  };
}

function fromDocument(data: DocumentData, id: string): AssessmentRecord {
  return {
    id: data.id ?? id,
    timestamp: data.timestamp ?? data.assessmentDate ?? '',
    demographics: {
      nurseCode: data.nurseCode,
      ward: data.ward,
      shift: data.shift,
      qualification: data.qualification,
      yearsExperience: data.yearsExperience,
      patientLoad: data.patientLoad,
      date: data.assessmentDate ?? data.timestamp ?? '',
    },
    workloadResponses: numericMap(data.workloadResponses),
    ipcResponses: numericMap(data.ipcResponses),
    workloadScore: data.workloadScore,
    ipcScore: data.ipcScore,
    workloadCategory: data.workloadCategory,
    ipcCategory: data.ipcCategory,
    subscoreWorkload: data.subscoreWorkload ?? {},
    subscoreIPC: data.subscoreIPC ?? {},
    excluded: data.excluded === true,
  } as AssessmentRecord;
}

// Firestore map keys are always strings; item ids are numbers.
function numericMap(raw: unknown): Record<number, number> {
  const out: Record<number, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[Number(k)] = n;
    }
  }
  return out;
}

function withAckTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise<T | 'timeout'>((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Persists one completed assessment. The document id is the record id, so a
 * retry overwrites rather than duplicating.
 *
 * Resolves 'confirmed' when the server acknowledged the write, or 'pending'
 * when the device is offline and the SDK holds the write for replay. It only
 * rejects when the write is genuinely refused (bad shape, rules, no config).
 */
export async function submitRecord(record: AssessmentRecord): Promise<SubmitOutcome> {
  const firestore = requireDb();
  const write = setDoc(
    doc(firestore, RECORDS_COLLECTION, record.id),
    toDocument(record),
    { merge: true },
  );
  const result = await withAckTimeout(write, WRITE_ACK_TIMEOUT_MS);
  return result === 'timeout' ? 'pending' : 'confirmed';
}

/**
 * Marks a record as excluded from (or restored to) the analysis.
 *
 * Records are append-only by design — the rules forbid client deletes — so a
 * test submission or a withdrawn participant is flagged rather than destroyed.
 * Everything downstream (statistics, charts, exports) reads only the records
 * where `excluded` is false.
 */
export async function setRecordExcluded(id: string, excluded: boolean): Promise<void> {
  const firestore = requireDb();
  await updateDoc(doc(firestore, RECORDS_COLLECTION, id), { excluded });
}

// ── Live read ─────────────────────────────────────────────────────────────

export interface RecordsSnapshot {
  records: AssessmentRecord[];
  /** Writes made on this device that the server has not acknowledged yet. */
  pendingWrites: boolean;
  /** True while the data being shown came from the offline cache. */
  fromCache: boolean;
}

export function subscribeToRecords(
  onChange: (snapshot: RecordsSnapshot) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!firebaseConfigured || !db) {
    onError?.(new DatabaseUnavailableError());
    return () => {};
  }

  return onSnapshot(
    query(collection(db, RECORDS_COLLECTION), orderBy('submittedAt', 'desc')),
    { includeMetadataChanges: true },
    snap => onChange({
      records: snap.docs.map(d => fromDocument(d.data(), d.id)),
      pendingWrites: snap.metadata.hasPendingWrites,
      fromCache: snap.metadata.fromCache,
    }),
    err => onError?.(err),
  );
}

/** Records that count towards the study — the analysis never sees the rest. */
export function analysable(records: AssessmentRecord[]): AssessmentRecord[] {
  return records.filter(r => !r.excluded);
}
