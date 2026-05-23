import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Download, Plus, BarChart2, Upload, WifiOff, Loader2 } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import ScoreCard from '../components/ScoreCard';
import {
  calcWorkloadScore, calcWorkloadSubscores, getWorkloadCategory,
  calcIPCScore, calcIPCSubscores, getIPCCategory,
} from '../utils/scoring';
import { getSession, clearSession, saveRecord, generateId } from '../utils/storage';
import { exportSinglePDF } from '../utils/export';
import { uploadRecord, queueRecord, isSubmitted } from '../utils/sync';
import { supabaseConfigured as isConfigured } from '../lib/supabase';
import type { AssessmentRecord } from '../types';

const STEPS = ['Demographics', 'Workload', 'IPC Scale', 'Results'];

const INTERPRETATIONS: Record<string, string> = {
  Low: 'Workload is manageable. Adequate capacity to maintain quality care and IPC practices.',
  Moderate: 'Moderate workload. May experience occasional time pressure but generally maintains IPC standards.',
  High: 'High workload. Time and cognitive demands may compromise IPC compliance. Review staffing.',
  'Very High': 'Critically high workload. Significant risk that IPC practices are being bypassed. Urgent review needed.',
  Optimal: 'Excellent compliance. Consistently follows all standard precautions across all categories.',
  Satisfactory: 'Good compliance. Most standard precautions followed consistently with minor gaps.',
  Suboptimal: 'Compliance needs improvement. Several standard precautions not consistently practised.',
  Poor: 'Poor compliance. Significant gaps in infection prevention practice. Training and supervision required.',
};

type SubmitState = 'idle' | 'uploading' | 'success' | 'queued' | 'error';

export default function Results() {
  const navigate = useNavigate();
  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session?.demographics?.nurseCode || !session.workloadResponses || !session.ipcResponses) {
      navigate('/assess');
      return;
    }
    const wScore = calcWorkloadScore(session.workloadResponses);
    const iScore = calcIPCScore(session.ipcResponses);
    const rec: AssessmentRecord = {
      id: generateId(),
      timestamp: new Date().toLocaleString(),
      demographics: session.demographics as AssessmentRecord['demographics'],
      workloadResponses: session.workloadResponses,
      ipcResponses: session.ipcResponses,
      workloadScore: wScore,
      ipcScore: iScore,
      workloadCategory: getWorkloadCategory(wScore),
      ipcCategory: getIPCCategory(iScore),
      subscoreWorkload: calcWorkloadSubscores(session.workloadResponses),
      subscoreIPC: calcIPCSubscores(session.ipcResponses),
    };
    setRecord(rec);
    // Check if already submitted (page revisit)
    if (isSubmitted(rec.id)) setSubmitState('success');
  }, []);

  function handleSave() {
    if (!record || saved) return;
    saveRecord(record);
    clearSession();
    setSaved(true);
  }

  async function handleSubmit() {
    if (!record) return;
    // Save locally first if not already saved
    if (!saved) { saveRecord(record); clearSession(); setSaved(true); }

    setSubmitState('uploading');
    setSubmitError('');
    try {
      await uploadRecord(record);
      setSubmitState('success');
    } catch (err) {
      if (!navigator.onLine) {
        queueRecord(record.id);
        setSubmitState('queued');
      } else {
        setSubmitState('error');
        setSubmitError(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  }

  if (!record) return null;

  const alreadySubmitted = submitState === 'success' || isSubmitted(record.id);

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar step={4} total={4} labels={STEPS} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle size={22} className="text-green-500 flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800 text-sm sm:text-base">Assessment Complete</h2>
          <p className="text-xs text-gray-500 truncate">
            {record.demographics.nurseCode} • {record.demographics.ward} • {record.demographics.shift}
          </p>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <ScoreCard
          title="Nursing Workload"
          score={record.workloadScore}
          category={record.workloadCategory}
          color=""
          subscores={record.subscoreWorkload}
        />
        <ScoreCard
          title="IPC Compliance (CSPS)"
          score={record.ipcScore}
          category={record.ipcCategory}
          color=""
          subscores={record.subscoreIPC}
        />
      </div>

      {/* Interpretation */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-4">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Interpretation</h3>
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Workload — {record.workloadCategory}
            </span>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              {INTERPRETATIONS[record.workloadCategory]}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              IPC Compliance — {record.ipcCategory}
            </span>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              {INTERPRETATIONS[record.ipcCategory]}
            </p>
          </div>
        </div>
      </div>

      {/* ── Primary action: Submit to Study ────────────────────────────── */}
      {isConfigured && (
        <div className="mb-4">
          {submitState === 'idle' && (
            <button
              onClick={handleSubmit}
              className="w-full bg-green-600 text-white px-5 py-3.5 rounded-2xl text-sm font-bold hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-2 touch-manipulation shadow-sm"
            >
              <Upload size={18} />
              Submit to Study Database
            </button>
          )}

          {submitState === 'uploading' && (
            <div className="w-full bg-green-600/80 text-white px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Submitting…
            </div>
          )}

          {submitState === 'success' && (
            <div className="w-full bg-green-50 border border-green-300 text-green-700 px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle size={18} />
              Submitted to Study Database ✓
            </div>
          )}

          {submitState === 'queued' && (
            <div className="w-full bg-amber-50 border border-amber-300 text-amber-700 px-4 py-3.5 rounded-2xl text-sm font-medium flex items-start gap-3">
              <WifiOff size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Saved offline — queued for submission</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Your data is saved on this device. It will automatically submit to the study database when you're back online.
                </p>
              </div>
            </div>
          )}

          {submitState === 'error' && (
            <div className="space-y-2">
              <div className="w-full bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-2xl text-xs">
                <p className="font-semibold">Submission failed</p>
                <p className="opacity-80">{submitError}</p>
              </div>
              <button
                onClick={handleSubmit}
                className="w-full border border-green-400 text-green-700 px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-green-50 flex items-center justify-center gap-2 touch-manipulation"
              >
                <Upload size={16} />
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Secondary actions ───────────────────────────────────────────── */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3">
        {/* Show local save only when Supabase is not configured */}
        {!isConfigured && (
          !saved ? (
            <button
              onClick={handleSave}
              className="w-full sm:w-auto bg-primary-600 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 transition-colors flex items-center justify-center gap-2 touch-manipulation"
            >
              <CheckCircle size={16} />
              Save Record
            </button>
          ) : (
            <span className="w-full sm:w-auto bg-green-100 text-green-700 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              <CheckCircle size={16} />
              Saved Locally
            </span>
          )
        )}

        {/* When Supabase IS configured, still show "Save locally" as secondary after submit */}
        {isConfigured && !saved && submitState === 'idle' && (
          <button
            onClick={handleSave}
            className="w-full sm:w-auto border border-gray-300 text-gray-600 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2 touch-manipulation"
          >
            <CheckCircle size={16} />
            Save locally only
          </button>
        )}

        <button
          onClick={() => exportSinglePDF(record)}
          className="w-full sm:w-auto border border-gray-300 text-gray-700 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center gap-2 touch-manipulation"
        >
          <Download size={16} />
          Print / PDF
        </button>

        <button
          onClick={() => { if (!saved) { saveRecord(record); clearSession(); } else clearSession(); navigate('/assess'); }}
          className="w-full sm:w-auto border border-primary-300 text-primary-700 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-primary-50 flex items-center justify-center gap-2 touch-manipulation"
        >
          <Plus size={16} />
          New Assessment
        </button>

        {(saved || alreadySubmitted) && (
          <Link
            to="/analysis"
            className="w-full sm:w-auto border border-teal-300 text-teal-700 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-teal-50 flex items-center justify-center gap-2 touch-manipulation"
          >
            <BarChart2 size={16} />
            View Analysis
          </Link>
        )}
      </div>
    </div>
  );
}
