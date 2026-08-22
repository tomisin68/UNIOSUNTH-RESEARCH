import { useMemo, useState } from 'react';
import {
  Download, FileText, X, ChevronRight, Cloud, CloudOff, Loader2, Lock, EyeOff, Eye,
  AlertTriangle, Search,
} from 'lucide-react';
import { exportSinglePDF } from '../utils/export';
import { downloadDataCSV } from '../utils/report';
import { setRecordExcluded } from '../utils/records';
import { useRecords } from '../hooks/useRecords';
import { isUnlocked } from '../utils/coordinator';
import { shortWard } from '../data/wards';
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

function formatSubmitted(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function DetailModal({
  record,
  canEdit,
  onToggleExclude,
  onClose,
}: {
  record: AssessmentRecord;
  canEdit: boolean;
  onToggleExclude: (record: AssessmentRecord) => void;
  onClose: () => void;
}) {
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
            {record.excluded ? (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <EyeOff size={11} /> Excluded
              </span>
            ) : (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Cloud size={11} /> In analysis
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
                ['Submitted', formatSubmitted(record.timestamp)],
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

          {canEdit && (
            <button
              onClick={() => onToggleExclude(record)}
              className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-xl text-xs font-medium hover:bg-gray-50 flex items-center justify-center gap-2 touch-manipulation"
            >
              {record.excluded ? <Eye size={14} /> : <EyeOff size={14} />}
              {record.excluded ? 'Restore to the analysis' : 'Exclude from the analysis'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DataManager() {
  const { all, records, loading, error, pendingWrites, fromCache, configured } = useRecords();
  const [selected, setSelected] = useState<AssessmentRecord | null>(null);
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [unlocked, setUnlocked] = useState(() => isUnlocked());
  const [showExcluded, setShowExcluded] = useState(false);
  const [filter, setFilter] = useState('');
  const [actionError, setActionError] = useState('');

  const visible = useMemo(() => {
    const base = showExcluded ? all : records;
    const needle = filter.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(r =>
      r.demographics.nurseCode.toLowerCase().includes(needle)
      || r.demographics.ward.toLowerCase().includes(needle)
      || r.demographics.shift.toLowerCase().includes(needle),
    );
  }, [all, records, showExcluded, filter]);

  async function handleToggleExclude(record: AssessmentRecord) {
    setActionError('');
    try {
      await setRecordExcluded(record.id, !record.excluded);
      setSelected(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the record');
    }
  }

  if (!configured) {
    return (
      <div className="text-center py-16 sm:py-24">
        <AlertTriangle size={40} className="mx-auto text-red-300 mb-3" />
        <h3 className="text-gray-600 font-medium">Study database not configured</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
          Add the Firebase credentials to <code>.env</code> and rebuild. Records are stored in the
          database only — there is no local copy to fall back on.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16 sm:py-24">
        <Loader2 size={32} className="mx-auto text-primary-400 mb-3 animate-spin" />
        <p className="text-sm text-gray-400">Loading records from the study database…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 sm:py-24">
        <AlertTriangle size={40} className="mx-auto text-red-300 mb-3" />
        <h3 className="text-gray-600 font-medium">Could not read the database</h3>
        <p className="text-sm text-gray-400 mt-1">{error}</p>
      </div>
    );
  }

  if (!all.length) {
    return (
      <div className="text-center py-16 sm:py-24">
        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-gray-500 font-medium">No records yet</h3>
        <p className="text-sm text-gray-400 mt-1">
          Submitted assessments appear here the moment they reach the database.
        </p>
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
            <span className="text-primary-600">
              {records.length} record{records.length !== 1 ? 's' : ''}
            </span>
            {all.length !== records.length && (
              <span className="text-gray-400 font-normal text-xs ml-1.5">
                ({all.length - records.length} excluded)
              </span>
            )}
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => downloadDataCSV(showExcluded ? all : records)}
              className="bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-primary-700 active:bg-primary-800 touch-manipulation"
            >
              <Download size={14} />
              Export CSV
            </button>
            {!unlocked && (
              <button
                onClick={() => setShowCoordModal(true)}
                className="border border-gray-300 text-gray-600 px-3 sm:px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-gray-50 touch-manipulation"
              >
                <Lock size={13} />
                Coordinator access
              </button>
            )}
          </div>
        </div>

        {/* Live connection state */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-wrap items-center gap-3">
          {fromCache ? (
            <CloudOff size={16} className="text-amber-500 flex-shrink-0" />
          ) : (
            <Cloud size={16} className="text-green-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700">
              {fromCache ? 'Offline — showing the last known data' : 'Live from the study database'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {pendingWrites
                ? 'A submission from this device is still uploading.'
                : 'Every record here is stored in the database; nothing is kept on this device.'}
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={e => setShowExcluded(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show excluded
          </label>
        </div>

        {actionError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {actionError}
          </p>
        )}

        {/* Filter */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by code, ward or shift…"
            className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        {/* ── Mobile card list ──────────────────────── */}
        <div className="sm:hidden space-y-2">
          {visible.map(r => (
            <div
              key={r.id}
              onClick={() => setSelected(r)}
              className={`bg-white border rounded-2xl p-4 flex items-center gap-3 active:bg-gray-50 touch-manipulation cursor-pointer ${
                r.excluded ? 'border-gray-200 opacity-60' : 'border-gray-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-gray-800">{r.demographics.nurseCode}</span>
                  <span className="text-xs text-gray-400">{r.demographics.shift}</span>
                  {r.excluded && <EyeOff size={12} className="text-gray-400" />}
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
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* ── Desktop table ─────────────────────────── */}
        <div className="hidden sm:block overflow-x-auto bg-white border border-gray-200 rounded-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Code', 'Ward', 'Shift', 'Workload', 'IPC Score', 'Submitted', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r === selected ? null : r)}
                  className={`border-b border-gray-100 cursor-pointer transition-colors ${
                    r.id === selected?.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                  } ${r.excluded ? 'opacity-55' : ''}`}
                >
                  <td className="px-4 py-3 font-semibold text-gray-800">{r.demographics.nurseCode}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-32 truncate">
                    {shortWard(r.demographics.ward)}
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
                  <td className="px-4 py-3 text-gray-400">{formatSubmitted(r.timestamp)}</td>
                  <td className="px-4 py-3">
                    {r.excluded ? (
                      <span className="flex items-center gap-1 text-gray-500 font-medium">
                        <EyeOff size={12} /> Excluded
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <Cloud size={12} /> In analysis
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Records are append-only: a test entry or a withdrawn participant is excluded from the
          analysis rather than deleted, which keeps the audit trail the ethics protocol expects.
          Excluding a record needs coordinator access.
        </p>
      </div>

      {selected && (
        <DetailModal
          record={selected}
          canEdit={unlocked}
          onToggleExclude={handleToggleExclude}
          onClose={() => setSelected(null)}
        />
      )}

      {showCoordModal && (
        <CoordinatorModal
          onSuccess={() => { setUnlocked(true); setShowCoordModal(false); }}
          onClose={() => setShowCoordModal(false)}
        />
      )}
    </>
  );
}
