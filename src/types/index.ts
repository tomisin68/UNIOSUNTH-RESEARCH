export interface Demographics {
  nurseCode: string;
  ward: string;
  shift: 'Morning' | 'Afternoon' | 'Night';
  qualification: 'RN' | 'BNSc' | 'RN+BNSc' | 'MSc' | 'PhD';
  yearsExperience: string;
  patientLoad: string;
  date: string;
}

export interface ScaleItem {
  id: number;
  text: string;
  subscale: string;
  reversed: boolean;
}

export interface WorkloadResponse {
  [itemId: number]: number; // 1–5
}

export interface IPCResponse {
  [itemId: number]: number; // 1–4
}

export interface AssessmentRecord {
  id: string;
  timestamp: string;
  demographics: Demographics;
  workloadResponses: WorkloadResponse;
  ipcResponses: IPCResponse;
  workloadScore: number;       // 0–100 normalized
  ipcScore: number;            // 0–100 normalized
  workloadCategory: WorkloadCategory;
  ipcCategory: IPCCategory;
  subscoreWorkload: Record<string, number>;
  subscoreIPC: Record<string, number>;
}

export type WorkloadCategory = 'Low' | 'Moderate' | 'High' | 'Very High';
export type IPCCategory = 'Poor' | 'Suboptimal' | 'Satisfactory' | 'Optimal';

export interface AssessmentSession {
  demographics: Partial<Demographics>;
  workloadResponses: WorkloadResponse;
  ipcResponses: IPCResponse;
  step: number;
}
