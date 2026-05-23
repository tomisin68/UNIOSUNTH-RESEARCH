import type { AssessmentRecord, AssessmentSession } from '../types';

const RECORDS_KEY = 'uniosunth_records';
const SESSION_KEY = 'uniosunth_session';

export function saveRecord(record: AssessmentRecord): void {
  const records = getAllRecords();
  records.push(record);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function getAllRecords(): AssessmentRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? (JSON.parse(raw) as AssessmentRecord[]) : [];
  } catch {
    return [];
  }
}

export function deleteRecord(id: string): void {
  const records = getAllRecords().filter(r => r.id !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function clearAllRecords(): void {
  localStorage.removeItem(RECORDS_KEY);
}

export function saveSession(session: Partial<AssessmentSession>): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Partial<AssessmentSession> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Generates a short, unique, human-readable nurse code: NRS-XXXXXX
// Uses crypto.randomUUID where available, falls back to Math.random
export function generateNurseCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  for (const byte of arr) code += chars[byte % chars.length];
  return `NRS-${code}`;
}
