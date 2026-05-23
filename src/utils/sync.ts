import { supabase, supabaseConfigured } from '../lib/supabase';
import type { AssessmentRecord } from '../types';
import { getAllRecords, saveRecord } from './storage';

const QUEUE_KEY = 'uniosunth_upload_queue';
const SUBMITTED_KEY = 'uniosunth_submitted_ids';

// ── Offline queue ─────────────────────────────────────────────────────────

export function queueRecord(id: string): void {
  const q = getQueue();
  if (!q.includes(id)) {
    q.push(id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }
}

export function getQueue(): string[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); }
  catch { return []; }
}

function removeFromQueue(id: string): void {
  const q = getQueue().filter(i => i !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function markSubmitted(id: string): void {
  const s = getSubmittedIds();
  s.add(id);
  localStorage.setItem(SUBMITTED_KEY, JSON.stringify([...s]));
  removeFromQueue(id);
}

export function getSubmittedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SUBMITTED_KEY) ?? '[]')); }
  catch { return new Set(); }
}

export function isSubmitted(id: string): boolean {
  return getSubmittedIds().has(id);
}

// ── Upload a single record ────────────────────────────────────────────────

export async function uploadRecord(record: AssessmentRecord): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase not configured');

  const row = {
    id: record.id,
    nurse_code: record.demographics.nurseCode,
    ward: record.demographics.ward,
    shift: record.demographics.shift,
    qualification: record.demographics.qualification,
    years_experience: record.demographics.yearsExperience,
    patient_load: record.demographics.patientLoad,
    assessment_date: record.timestamp,
    workload_score: record.workloadScore,
    ipc_score: record.ipcScore,
    workload_category: record.workloadCategory,
    ipc_category: record.ipcCategory,
    subscore_workload: record.subscoreWorkload,
    subscore_ipc: record.subscoreIPC,
    workload_responses: record.workloadResponses,
    ipc_responses: record.ipcResponses,
  };

  const { error } = await supabase
    .from('assessment_records')
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
  markSubmitted(record.id);
}

// ── Flush queued records ──────────────────────────────────────────────────

export async function flushQueue(): Promise<{ uploaded: number; failed: number }> {
  if (!supabaseConfigured || !supabase) return { uploaded: 0, failed: 0 };
  const queue = getQueue();
  if (!queue.length) return { uploaded: 0, failed: 0 };

  const allRecords = getAllRecords();
  let uploaded = 0;
  let failed = 0;

  for (const id of queue) {
    const record = allRecords.find(r => r.id === id);
    if (!record) { removeFromQueue(id); continue; }
    try {
      await uploadRecord(record);
      uploaded++;
    } catch {
      failed++;
    }
  }
  return { uploaded, failed };
}

// ── Download all records from Supabase (coordinator) ─────────────────────

export async function downloadAllRecords(): Promise<AssessmentRecord[]> {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('assessment_records')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    timestamp: row.assessment_date,
    demographics: {
      nurseCode: row.nurse_code,
      ward: row.ward,
      shift: row.shift,
      qualification: row.qualification,
      yearsExperience: row.years_experience,
      patientLoad: row.patient_load,
      date: row.assessment_date,
    },
    workloadResponses: row.workload_responses ?? {},
    ipcResponses: row.ipc_responses ?? {},
    workloadScore: row.workload_score,
    ipcScore: row.ipc_score,
    workloadCategory: row.workload_category,
    ipcCategory: row.ipc_category,
    subscoreWorkload: row.subscore_workload ?? {},
    subscoreIPC: row.subscore_ipc ?? {},
  })) as AssessmentRecord[];
}

// ── Merge cloud records into local storage ────────────────────────────────

export async function syncFromCloud(): Promise<number> {
  const cloud = await downloadAllRecords();
  const existing = new Set(getAllRecords().map(r => r.id));
  let added = 0;
  for (const r of cloud) {
    if (!existing.has(r.id)) {
      saveRecord(r);
      markSubmitted(r.id);
      added++;
    }
  }
  return added;
}

// ── Auto-flush on connectivity restore ───────────────────────────────────

export function initAutoSync(): () => void {
  const handler = () => {
    if (navigator.onLine && getQueue().length) {
      flushQueue().catch(() => { /* silent */ });
    }
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
