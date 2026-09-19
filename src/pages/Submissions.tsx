import { useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, CloudOff, Download,
  FileText, Loader2, Printer, Search,
} from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { printSubmissions } from '../utils/submissions';
import { downloadDataCSV } from '../utils/report';
import { WORKLOAD_ITEMS, WORKLOAD_LABELS } from '../data/workloadItems';
import { IPC_ITEMS, IPC_LABELS } from '../data/ipcItems';
import type { AssessmentRecord } from '../types';

// ── Submissions register ──────────────────────────────────────────────────
// Every submission the study has received, in one place, for the coordinator
// to read and print. It deliberately shows excluded records too: the register
// is the audit trail, so a withdrawn or test entry has to remain visible and
// clearly marked rather than disappearing.

const WORKLOAD_BADGE: Record<string, string> = {
  Low: 'bg-green-100 text-green-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  'Very High': 'bg-red-100 text-red-700',
};

const IPC_BADGE: Record<string, string> = {
  Optimal: 'bg-green-100 text-green-700',
  Satisfactory: 'bg-blue-100 text-blue-700',
  Suboptimal: 'bg-yellow-100 text-yellow-700',
  Poor: 'bg-red-100 text-red-700',
};

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function ResponseList({
  items, labels, answers, prefix,
}: {
  items: typeof WORKLOAD_ITEMS;
  labels: Record<number, string>;
  answers: Record<number, number>;
  prefix: string;
}) {
  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
      {items.map(item => {
        const value = answers?.[item.id];
        return (
          <div key={item.id} className="flex gap-3 px-3 py-2 text-xs bg-white">
            <span className="font-mono text-gray-400 flex-shrink-0 w-10">
              {prefix}{item.id}
            </span>
            <span className="flex-1 text-gray-700 leading-relaxed">
              {item.text}
              {item.reversed && (
                <span className="text-gray-400 ml-1">(reverse scored)</span>
              )}
            </span>
            <span className="flex-shrink-0 font-semibold text-gray-800 text-right w-28">
              {value == null ? '—' : `${value} · ${labels[value] ?? ''}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SubmissionRow({ record, index }: { record: AssessmentRecord; index: number }) {
  const [open, setOpen] = useState(false);
  const d = record.demographics;

  return (
    <div className={`border rounded-xl overflow-hidden ${
      record.excluded ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
    }`}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors"
      >
        <span className="text-xs text-gray-400 font-medium w-6 flex-shrink-0">{index + 1}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${
              record.excluded ? 'text-gray-400 line-through' : 'text-gray-800'
            }`}>
              {d.nurseCode}
            </span>
            {record.excluded && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                Excluded
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {d.ward} · {d.shift} · {d.qualification}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
            WORKLOAD_BADGE[record.workloadCategory] ?? 'bg-gray-100 text-gray-600'
          }`}>
            WL {record.workloadScore}%
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
            IPC_BADGE[record.ipcCategory] ?? 'bg-gray-100 text-gray-600'
          }`}>
            IPC {record.ipcScore}%
          </span>
        </div>

        {open
          ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
          : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 sm:px-4 py-4 space-y-4 bg-gray-50/60">
          <div className="sm:hidden flex gap-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
              WORKLOAD_BADGE[record.workloadCategory] ?? 'bg-gray-100 text-gray-600'
            }`}>
              Workload {record.workloadScore}% · {record.workloadCategory}
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
              IPC_BADGE[record.ipcCategory] ?? 'bg-gray-100 text-gray-600'
            }`}>
              IPC {record.ipcScore}% · {record.ipcCategory}
            </span>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            {[
              ['Ward', d.ward],
              ['Shift', d.shift],
              ['Qualification', d.qualification],
              ['Experience', d.yearsExperience],
              ['Patients this shift', d.patientLoad],
              ['Submitted', formatDate(record.timestamp)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-gray-400 font-medium">{label}</dt>
                <dd className="text-gray-800 font-medium mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Nursing Workload Scale
            </h4>
            <ResponseList
              items={WORKLOAD_ITEMS}
              labels={WORKLOAD_LABELS}
              answers={record.workloadResponses}
              prefix="WL"
            />
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              IPC Compliance Scale
            </h4>
            <ResponseList
              items={IPC_ITEMS}
              labels={IPC_LABELS}
              answers={record.ipcResponses}
              prefix="IPC"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Submissions() {
  const { all, loading, error, fromCache, configured } = useRecords();
  const [filter, setFilter] = useState('');
  const [printError, setPrintError] = useState('');

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(r =>
      r.demographics.nurseCode.toLowerCase().includes(needle)
      || r.demographics.ward.toLowerCase().includes(needle)
      || r.demographics.shift.toLowerCase().includes(needle)
      || r.demographics.qualification.toLowerCase().includes(needle),
    );
  }, [all, filter]);

  function handlePrint(includeDetail: boolean) {
    setPrintError('');
    if (!printSubmissions(visible, { includeDetail })) {
      setPrintError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    }
  }

  if (!configured) {
    return (
      <div className="text-center py-16 sm:py-24">
        <AlertTriangle size={40} className="mx-auto text-red-300 mb-3" />
        <h3 className="text-gray-600 font-medium">Study database not configured</h3>
        <p className="text-sm text-gray-400 mt-1">
          Submissions are stored in the database only.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16 sm:py-24">
        <Loader2 size={32} className="mx-auto text-primary-400 mb-3 animate-spin" />
        <p className="text-sm text-gray-400">Loading submissions…</p>
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

  const included = all.filter(r => !r.excluded).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Submissions</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Every assessment received by the study, including entries excluded from analysis.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Total', all.length],
          ['In analysis', included],
          ['Excluded', all.length - included],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-primary-700 leading-none">{value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {fromCache && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <CloudOff size={14} className="flex-shrink-0" />
          Showing the offline copy — reconnect for the latest submissions.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by nurse code, ward, shift…"
            className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handlePrint(false)}
            disabled={!visible.length}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 touch-manipulation transition-colors"
          >
            <Printer size={15} />
            Print list
          </button>
          <button
            onClick={() => handlePrint(true)}
            disabled={!visible.length}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 border border-primary-600 text-primary-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-50 active:bg-primary-100 disabled:opacity-50 touch-manipulation transition-colors"
          >
            <FileText size={15} />
            Print full
          </button>
          <button
            onClick={() => downloadDataCSV(visible)}
            disabled={!visible.length}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation transition-colors"
          >
            <Download size={15} />
            CSV
          </button>
        </div>
      </div>

      {printError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {printError}
        </p>
      )}

      {!all.length ? (
        <div className="text-center py-16">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-gray-500 font-medium">No submissions yet</h3>
          <p className="text-sm text-gray-400 mt-1">
            Completed assessments appear here the moment they reach the database.
          </p>
        </div>
      ) : !visible.length ? (
        <div className="text-center py-12">
          <Search size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No submissions match “{filter}”.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            Showing {visible.length} of {all.length} · tap a row to see every answer
          </p>
          <div className="space-y-2">
            {visible.map((record, i) => (
              <SubmissionRow key={record.id} record={record} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
