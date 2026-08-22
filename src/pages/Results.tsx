import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle, Download, Plus, BarChart2, Upload, CloudOff, Loader2, AlertTriangle,
} from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import ScoreCard from '../components/ScoreCard';
import {
  calcWorkloadScore, calcWorkloadSubscores, getWorkloadCategory,
  calcIPCScore, calcIPCSubscores, getIPCCategory,
} from '../utils/scoring';
import { generateId } from '../utils/ids';
import { exportSinglePDF } from '../utils/export';
import { submitRecord } from '../utils/records';
import { firebaseConfigured } from '../lib/firebase';
import { useSession } from '../context/SessionContext';
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

type SubmitState = 'idle' | 'submitting' | 'confirmed' | 'pending' | 'error';

export default function Results() {
  const navigate = useNavigate();
  const { session, resetSession, hasParticipant } = useSession();
  const [state, setState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Scored once from the in-memory answers. The record only exists in the
  // database after it is submitted — nothing is written to this device.
  const record = useMemo<AssessmentRecord | null>(() => {
    const { demographics, workloadResponses, ipcResponses } = session;
    if (!demographics.nurseCode || !Object.keys(ipcResponses).length) return null;

    const workloadScore = calcWorkloadScore(workloadResponses);
    const ipcScore = calcIPCScore(ipcResponses);
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      demographics: demographics as AssessmentRecord['demographics'],
      workloadResponses,
      ipcResponses,
      workloadScore,
      ipcScore,
      workloadCategory: getWorkloadCategory(workloadScore),
      ipcCategory: getIPCCategory(ipcScore),
      subscoreWorkload: calcWorkloadSubscores(workloadResponses),
      subscoreIPC: calcIPCSubscores(ipcResponses),
      excluded: false,
    };
    // A new id per sitting; recomputing on every keystroke is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.demographics.nurseCode]);

  useEffect(() => {
    if (!hasParticipant || !record) navigate('/assess', { replace: true });
  }, [hasParticipant, record, navigate]);

  async function handleSubmit() {
    if (!record) return;
    setState('submitting');
    setErrorMessage('');
    try {
      const outcome = await submitRecord(record);
      setState(outcome === 'confirmed' ? 'confirmed' : 'pending');
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed');
    }
  }

  function startNewAssessment() {
    resetSession();
    navigate('/assess');
  }

  if (!record) return null;

  const submitted = state === 'confirmed' || state === 'pending';

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar step={4} total={4} labels={STEPS} />

      <div className="flex items-center gap-3 mb-4">
        <CheckCircle size={22} className="text-green-500 flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800 text-sm sm:text-base">Assessment Complete</h2>
          <p className="text-xs text-gray-500 truncate">
            {record.demographics.nurseCode} • {record.demographics.ward} • {record.demographics.shift}
          </p>
        </div>
      </div>

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

      {/* ── Submitting is the only way this record is kept ─────────────── */}
      {!firebaseConfigured ? (
        <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Study database not configured</p>
            <p className="text-xs mt-1 opacity-90">
              This response cannot be saved. Add the Firebase credentials to <code>.env</code> and
              rebuild before collecting data.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          {state === 'idle' && (
            <>
              <button
                onClick={handleSubmit}
                className="w-full bg-green-600 text-white px-5 py-3.5 rounded-2xl text-sm font-bold hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-2 touch-manipulation shadow-sm"
              >
                <Upload size={18} />
                Submit to Study Database
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                This response is held in memory only until you submit it.
              </p>
            </>
          )}

          {state === 'submitting' && (
            <div className="w-full bg-green-600/80 text-white px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Submitting…
            </div>
          )}

          {state === 'confirmed' && (
            <div className="w-full bg-green-50 border border-green-300 text-green-700 px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle size={18} />
              Saved to the study database
            </div>
          )}

          {state === 'pending' && (
            <div className="w-full bg-amber-50 border border-amber-300 text-amber-700 px-4 py-3.5 rounded-2xl text-sm flex items-start gap-3">
              <CloudOff size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Recorded — waiting for a connection</p>
                <p className="text-xs mt-0.5 opacity-90">
                  The submission is held by the database client and uploads by itself once this
                  device is back online. Keep the app installed until it does.
                </p>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-2">
              <div className="w-full bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-2xl text-xs">
                <p className="font-semibold">Submission refused</p>
                <p className="opacity-80">{errorMessage}</p>
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

      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3">
        <button
          onClick={() => exportSinglePDF(record)}
          className="w-full sm:w-auto border border-gray-300 text-gray-700 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center gap-2 touch-manipulation"
        >
          <Download size={16} />
          Print / PDF
        </button>

        <button
          onClick={startNewAssessment}
          className="w-full sm:w-auto border border-primary-300 text-primary-700 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-primary-50 flex items-center justify-center gap-2 touch-manipulation"
        >
          <Plus size={16} />
          New Assessment
        </button>

        {submitted && (
          <Link
            to="/analysis"
            onClick={resetSession}
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
