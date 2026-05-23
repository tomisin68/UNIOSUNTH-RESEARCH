import { WORKLOAD_ITEMS } from '../data/workloadItems';
import { IPC_ITEMS } from '../data/ipcItems';
import type {
  WorkloadResponse,
  IPCResponse,
  WorkloadCategory,
  IPCCategory,
} from '../types';

// ── Workload ───────────────────────────────────────────────────────────────
// Items 1–12, scale 1–5. Min=12, Max=60.
export function calcWorkloadScore(responses: WorkloadResponse): number {
  const total = WORKLOAD_ITEMS.reduce((sum, item) => {
    const raw = responses[item.id] ?? 1;
    return sum + (item.reversed ? 6 - raw : raw);
  }, 0);
  return Math.round(((total - 12) / (60 - 12)) * 100);
}

export function calcWorkloadSubscores(
  responses: WorkloadResponse
): Record<string, number> {
  const groups: Record<string, number[]> = {};
  for (const item of WORKLOAD_ITEMS) {
    if (!groups[item.subscale]) groups[item.subscale] = [];
    const raw = responses[item.id] ?? 1;
    groups[item.subscale].push(item.reversed ? 6 - raw : raw);
  }
  const result: Record<string, number> = {};
  for (const [subscale, scores] of Object.entries(groups)) {
    const n = scores.length;
    const min = n;
    const max = n * 5;
    const total = scores.reduce((a, b) => a + b, 0);
    result[subscale] = Math.round(((total - min) / (max - min)) * 100);
  }
  return result;
}

export function getWorkloadCategory(score: number): WorkloadCategory {
  if (score < 25) return 'Low';
  if (score < 50) return 'Moderate';
  if (score < 75) return 'High';
  return 'Very High';
}

// ── IPC Compliance ─────────────────────────────────────────────────────────
// Items 1–20, scale 1–4. Min=20, Max=80.
// Reverse-scored items: raw score is inverted (5 - raw for 1-4 scale → 4+1-raw).
export function calcIPCScore(responses: IPCResponse): number {
  const total = IPC_ITEMS.reduce((sum, item) => {
    const raw = responses[item.id] ?? 1;
    return sum + (item.reversed ? 5 - raw : raw);
  }, 0);
  return Math.round(((total - 20) / (80 - 20)) * 100);
}

export function calcIPCSubscores(
  responses: IPCResponse
): Record<string, number> {
  const groups: Record<string, number[]> = {};
  for (const item of IPC_ITEMS) {
    if (!groups[item.subscale]) groups[item.subscale] = [];
    const raw = responses[item.id] ?? 1;
    groups[item.subscale].push(item.reversed ? 5 - raw : raw);
  }
  const result: Record<string, number> = {};
  for (const [subscale, scores] of Object.entries(groups)) {
    const n = scores.length;
    const min = n;
    const max = n * 4;
    const total = scores.reduce((a, b) => a + b, 0);
    result[subscale] = Math.round(((total - min) / (max - min)) * 100);
  }
  return result;
}

export function getIPCCategory(score: number): IPCCategory {
  if (score < 50) return 'Poor';
  if (score < 70) return 'Suboptimal';
  if (score < 90) return 'Satisfactory';
  return 'Optimal';
}
