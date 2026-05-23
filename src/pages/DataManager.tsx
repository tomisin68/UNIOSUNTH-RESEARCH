import { useState, useEffect } from 'react';
import { Download, Trash2, FileText, AlertTriangle, X, ChevronRight, RefreshCw, Upload, Cloud, Loader2, WifiOff, Lock, ShieldCheck } from 'lucide-react';
import { getAllRecords, deleteRecord, clearAllRecords, saveRecord } from '../utils/storage';
import { exportToCSV, exportSinglePDF } from '../utils/export';
import { syncFromCloud, flushQueue, getQueue, isSubmitted, uploadRecord, markSubmitted } from '../utils/sync';
import { supabaseConfigured } from '../lib/supabase';
import { isUnlocked } from '../utils/coordinator';
import CoordinatorModal from '../components/CoordinatorModal';
import type { AssessmentRecord } from '../types';

const CAT_PILL: Record<string, string> = {
  Low: 'bg-green-100 text-green-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  'Very High': 'bg-red-100 text-red-700',
  Optimal: 'bg-green-100 text-green-700',
  Satisfactory: 'bg-blue-100 text-blue-700',
  Suboptimal: 'bg-yellow-100 text-yellow-700',
  Poor: 'bg-red-100 text-red-700',
};

function DetailModal({
  record,
  onClose,
}: {
  record: AssessmentRecord;
  onClose: () => void;
}) {
  const submitted = isSubmitted(record.id);
  const queued = getQueue().includes(record.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Record Detail</h3>
          <div className="flex items-center gap-2">
            {submitted && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Cloud size={11} /> Submitted
              </span>
            )}
            {queued && !submitted && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <WifiOff size={11} /> Queued
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Participant</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {[
                ['Code', record.demographics.nurseCode],
                ['Ward', record.demographics.ward],
                ['Shift', record.demographics.shift],
                ['Qualification', record.demographics.qualification],
                ['Experience', `${record.demographics.yearsExperience} yrs`],
                ['Patient load', record.demographics.patientLoad],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-xs text-gray-500">{k}</span>
                  <p className="font-medium text-gray-800 text-xs mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Scores</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{record.workloadScore}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Workload</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${CAT_PILL[record.workloadCategory]}`}>
                  {record.workloadCategory}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{record.ipcScore}%</p>
                <p className="text-xs text-gray-500 mt-0.5">IPC</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${CAT_PILL[record.ipcCategory]}`}>
                  {record.ipcCategory}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Subscores</p>
            {[...Object.entries(record.subscoreWorkload), ...Object.entries(record.subscoreIPC)].map(([k, v]) => (
              <div key={k} className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span className="truncate mr-2">{k}</span>
                  <span className="font-semibold flex-shrink-0">{v}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => exportSinglePDF(record)}
            className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 flex items-center justify-center gap-2 touch-manipulation"
          >
            <FileText size={15} />
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export default function DataManager() {
  const [records, setRecords] = useState<AssessmentRecord[]>(getAllRecords);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selected, setSelected] = useState<AssessmentRecord | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [queueCount, setQueueCount] = useState(() => getQueue().length);
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [unlocked, setUnlocked] = useState(() => isUnlocked());

  // Refresh queue count when records change
  useEffect(() => { setQueueCount(getQueue().length); }, [records]);

  function refresh() { setRecords(getAllRecords()); }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteRecord(id);
    if (selected?.id === id) setSelected(null);
    refresh();
  }

  function handleClearAll() {
    clearAllRecords();
    setConfirmClear(false);
    setSelected(null);
    refresh();
  }

  async function handleSyncFromCloud() {
    setSyncState('syncing');
    setSyncMsg('');
    try {
      const added = await syncFromCloud();
      refresh();
      setSyncMsg(`Sync complete — ${added} new record${added !== 1 ? 's' : ''} downloaded`);
      setSyncState('done');
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed');
      setSyncState('error');
    }
    setTimeout(() => setSyncState('idle'), 4000);
  }

  async function handleFlushQueue() {
    setSyncState('syncing');
    setSyncMsg('');
    try {
      const { uploaded, failed } = await flushQueue();
      setQueueCount(getQueue().length);
      setSyncMsg(`Uploaded ${uploaded} record${uploaded !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`);
      setSyncState(failed ? 'error' : 'done');
    } catch {
      setSyncState('error');
      setSyncMsg('Upload failed');
    }
    setTimeout(() => setSyncState('idle'), 4000);
  }

  if (!records.length) {
    return (
      <div className="text-center py-16 sm:py-24">
        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-gray-500 font-medium">No records yet</h3>
        <p className="text-sm text-gray-400 mt-1 mb-5">Complete an assessment to see data here.</p>
        {supabaseConfigured && (
          <button
            onClick={handleSyncFromCloud}
            disabled={syncState === 'syncing'}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 touch-manipulation disabled:opacity-50"
          >
            {syncState === 'syncing' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Load from Cloud
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-800 text-sm sm:text-base">
            Data Manager —{' '}
            <span className="text-primary-600">{records.length} record{records.length !== 1 ? 's' : ''}</span>
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => exportToCSV(records)}
              className="bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-primary-700 active:bg-primary-800 touch-manipulation"
            >
              <Download size={14} />
              Export CSV
            </button>

            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="border border-red-300 text-red-600 px-3 sm:px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-red-50 touch-manipulation"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            ) : (
              <div className="flex gap-2 items-center bg-red-50 border border-red-300 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600">Delete all?</span>
                <button onClick={handleClearAll} className="text-xs font-bold text-red-700 hover:underline touch-manipulation">Yes</button>
                <button onClick={() => setConfirmClear(false)} className="text-xs text-gray-500 hover:underline touch-manipulation">No</button>
              </div>
            )}
          </div>
        </div>

        {/* Cloud sync bar — coordinator PIN required */}
        {supabaseConfigured && (
          <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-wrap items-center gap-3">
            <Cloud size={16} className={`flex-shrink-0 ${unlocked ? 'text-green-500' : 'text-gray-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">
                Study Database Sync
                {!unlocked && (
                  <span className="ml-2 text-gray-400 font-normal">(coordinator only)</span>
                )}
              </p>
              {syncMsg && (
                <p className={`text-xs mt-0.5 ${syncState === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                  {syncMsg}
                </p>
              )}
            </div>

            {unlocked ? (
              <div className="flex gap-2 flex-shrink-0">
                {queueCount > 0 && (
                  <button
                    onClick={handleFlushQueue}
                    disabled={syncState === 'syncing' || !navigator.onLine}
                    className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 touch-manipulation"
                  >
                    {syncState === 'syncing' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Upload {queueCount} queued
                  </button>
                )}
                <button
                  onClick={handleSyncFromCloud}
                  disabled={syncState === 'syncing'}
                  className="flex items-center gap-1.5 border border-primary-300 text-primary-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary-50 disabled:opacity-50 touch-manipulation"
                >
                  {syncState === 'syncing' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Sync from cloud
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCoordModal(true)}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 touch-manipulation"
              >
                <Lock size={12} />
                Coordinator access
              </button>
            )}
          </div>
        )}

        {/* ── Mobile card list ──────────────────────── */}
        <div className="sm:hidden space-y-2">
          {records.map(r => {
            const submitted = supabaseConfigured && isSubmitted(r.id);
            const queued = supabaseConfigured && getQueue().includes(r.id);
            return (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 active:bg-gray-50 touch-manipulation cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-800">{r.demographics.nurseCode}</span>
                    <span className="text-xs text-gray-400">{r.demographics.shift}</span>
                    {submitted && <Cloud size={12} className="text-green-500" />}
                    {queued && !submitted && <WifiOff size={12} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-2">{r.demographics.ward}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_PILL[r.workloadCategory]}`}>
                      W: {r.workloadScore}% {r.workloadCategory}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_PILL[r.ipcCategory]}`}>
                      IPC: {r.ipcScore}% {r.ipcCategory}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={e => handleDelete(r.id, e)}
                    className="p-2 text-gray-300 hover:text-red-500 active:text-red-600 transition-colors touch-manipulation"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop table ─────────────────────────── */}
        <div className="hidden sm:block overflow-x-auto bg-white border border-gray-200 rounded-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ward</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Shift</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Workload</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">IPC Score</th>
                {supabaseConfigured && (
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                )}
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const submitted = isSubmitted(r.id);
                const queued = getQueue().includes(r.id);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r === selected ? null : r)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      r.id === selected?.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">{r.demographics.nurseCode}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-32 truncate">
                      {r.demographics.ward.replace(' Ward', '').replace(' Unit', '')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.demographics.shift}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${CAT_PILL[r.workloadCategory]}`}>
                        {r.workloadScore}% {r.workloadCategory}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${CAT_PILL[r.ipcCategory]}`}>
                        {r.ipcScore}% {r.ipcCategory}
                      </span>
                    </td>
                    {supabaseConfigured && (
                      <td className="px-4 py-3">
                        {submitted ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <Cloud size={12} /> Submitted
                          </span>
                        ) : queued ? (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <WifiOff size={12} /> Queued
                          </span>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await uploadRecord(r);
                                markSubmitted(r.id);
                                setQueueCount(getQueue().length);
                                refresh();
                              } catch {
                                // silent
                              }
                            }}
                            className="text-gray-400 hover:text-primary-600 flex items-center gap-1 font-medium text-xs hover:underline touch-manipulation"
                          >
                            <Upload size={11} /> Submit
                          </button>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button
                        onClick={e => handleDelete(r.id, e)}
                        className="text-gray-300 hover:text-red-500 transition-colors touch-manipulation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <DetailModal record={selected} onClose={() => setSelected(null)} />}

      {showCoordModal && (
        <CoordinatorModal
          onSuccess={() => { setUnlocked(true); setShowCoordModal(false); }}
          onClose={() => setShowCoordModal(false)}
        />
      )}
    </>
  );
}
