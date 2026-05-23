import { Link } from 'react-router-dom';
import { Activity, BarChart2, BookOpen, Database, ShieldCheck } from 'lucide-react';
import { getAllRecords } from '../utils/storage';
import { WORKLOAD_ITEMS, WORKLOAD_SUBSCALES } from '../data/workloadItems';
import { IPC_ITEMS, IPC_SUBSCALES } from '../data/ipcItems';

const TOTAL_ITEMS = WORKLOAD_ITEMS.length + IPC_ITEMS.length;
const TOTAL_SUBSCALES = WORKLOAD_SUBSCALES.length + IPC_SUBSCALES.length;

export default function Home() {
  const count = getAllRecords().length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-800 to-primary-600 rounded-2xl text-white p-5 sm:p-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 bg-white/20 rounded-xl p-2.5 sm:p-3">
            <Activity size={24} className="sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold mb-1.5 sm:mb-2 leading-tight">
              Nursing Workload &amp; IPC Compliance Assessment
            </h2>
            <p className="text-primary-100 text-xs sm:text-sm leading-relaxed">
              A validated digital tool for assessing the relationship between nursing workload and
              infection prevention compliance among nurses in medical wards of UNIOSUNTH.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
              <Link
                to="/assess"
                className="bg-white text-primary-700 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-primary-50 transition-colors text-center touch-manipulation"
              >
                Start New Assessment
              </Link>
              {count > 0 && (
                <Link
                  to="/analysis"
                  className="border border-white/50 text-white font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors text-center touch-manipulation"
                >
                  View Analysis ({count} records)
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instruments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Activity size={18} className="text-primary-600 flex-shrink-0" />
            <h3 className="font-semibold text-gray-800 text-sm">Nursing Workload Scale</h3>
          </div>
          <p className="text-xs text-gray-600 mb-3 leading-relaxed">
            12-item adapted scale covering physical demands, cognitive/emotional demands,
            and administrative burden. Adapted from NAS and NASA-TLX for medical wards.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {['Physical', 'Cognitive', 'Administrative'].map(s => (
              <span key={s} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">Scale 1–5 • 12 items • ≈3 min</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <ShieldCheck size={18} className="text-teal-600 flex-shrink-0" />
            <h3 className="font-semibold text-gray-800 text-sm">IPC Compliance (CSPS)</h3>
          </div>
          <p className="text-xs text-gray-600 mb-3 leading-relaxed">
            Compliance with Standard Precautions Scale (Lam, 2004). Validated in Nigerian
            hospital settings. Covers PPE, sharps, decontamination, and hand hygiene.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {['PPE', 'Sharps', 'Decontam.', 'Hand Hygiene'].map(s => (
              <span key={s} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">Scale 1–4 • 20 items • ≈4 min</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 text-center">
          <Database size={18} className="mx-auto text-primary-500 mb-1.5" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{count}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">Records Collected</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 text-center">
          <BookOpen size={18} className="mx-auto text-teal-500 mb-1.5" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{TOTAL_ITEMS}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">Scale Items Total</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 text-center">
          <BarChart2 size={18} className="mx-auto text-purple-500 mb-1.5" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{TOTAL_SUBSCALES}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">Subscales</p>
        </div>
      </div>

      {/* How to use */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">How to Use</h3>
        <ol className="space-y-2.5">
          {[
            'Tap "Start New Assessment" to begin a data collection session.',
            'Enter anonymous nurse code, ward, shift, and experience details.',
            'Nurse completes the 12-item Nursing Workload Scale (≈3 min).',
            'Nurse completes the 20-item IPC Compliance Scale (≈4 min).',
            'Review individual scores and save the record.',
            '"Data" tab — view, export CSV, or print individual reports.',
            '"Analysis" tab — Spearman correlation and aggregate charts.',
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5 text-xs sm:text-sm text-gray-600">
              <span className="flex-shrink-0 w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
