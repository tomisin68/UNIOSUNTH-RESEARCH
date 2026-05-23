import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
import { getAllRecords } from '../utils/storage';
import {
  spearmanCorrelation, spearmanPValue, interpretCorrelation,
  getDescriptiveStats,
} from '../utils/statistics';
import { isUnlocked } from '../utils/coordinator';

const CAT_COLOR: Record<string, string> = {
  Low: '#16a34a', Moderate: '#ca8a04', High: '#ea580c', 'Very High': '#dc2626',
  Optimal: '#16a34a', Satisfactory: '#2563eb', Suboptimal: '#ca8a04', Poor: '#dc2626',
};

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
      <p className="text-lg sm:text-xl font-bold text-gray-800">{value}</p>
      <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analysis() {
  const records = getAllRecords();
  const coordinatorMode = isUnlocked();

  const stats = useMemo(() => {
    if (records.length < 2) return null;
    const xs = records.map(r => r.workloadScore);
    const ys = records.map(r => r.ipcScore);
    const r = spearmanCorrelation(xs, ys);
    const p = spearmanPValue(r, records.length);
    const desc = getDescriptiveStats(records);
    return { r, p, desc };
  }, [records.length]);

  const scatterData = records.map(r => ({
    x: r.workloadScore,
    y: r.ipcScore,
    name: r.demographics.nurseCode,
    wCat: r.workloadCategory,
  }));

  const wCatCounts = records.reduce((acc, r) => {
    acc[r.workloadCategory] = (acc[r.workloadCategory] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const iCatCounts = records.reduce((acc, r) => {
    acc[r.ipcCategory] = (acc[r.ipcCategory] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const catBarData = [
    { label: 'Low / Optimal',         workload: wCatCounts['Low'] ?? 0,       ipc: iCatCounts['Optimal'] ?? 0 },
    { label: 'Moderate / Satisfact.',  workload: wCatCounts['Moderate'] ?? 0,  ipc: iCatCounts['Satisfactory'] ?? 0 },
    { label: 'High / Suboptimal',      workload: wCatCounts['High'] ?? 0,      ipc: iCatCounts['Suboptimal'] ?? 0 },
    { label: 'Very High / Poor',       workload: wCatCounts['Very High'] ?? 0, ipc: iCatCounts['Poor'] ?? 0 },
  ];

  const subscaleData = useMemo(() => {
    if (!records.length) return [];
    const keys = [
      ...Object.keys(records[0].subscoreWorkload ?? {}),
      ...Object.keys(records[0].subscoreIPC ?? {}),
    ];
    return keys.map(k => {
      const vals = records.map(r => r.subscoreWorkload[k] ?? r.subscoreIPC[k] ?? 0);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { name: k.split(' ').slice(0, 2).join(' '), avg: Math.round(avg), full: k };
    });
  }, [records.length]);

  if (!records.length) {
    return (
      <div className="text-center py-16 sm:py-24">
        <TrendingDown size={40} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-gray-500 font-medium">No data to analyse</h3>
        <p className="text-sm text-gray-400 mt-1">Complete at least 2 assessments to run analysis.</p>
      </div>
    );
  }

  const needMore = records.length < 3;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800">
          Analysis —{' '}
          <span className="text-primary-600">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </span>
        </h2>
        {coordinatorMode && (
          <span className="text-xs font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
            Coordinator mode
          </span>
        )}
      </div>

      {/* Coordinator tip — only shown when not in coordinator mode */}
      {!coordinatorMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2.5">
          <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Showing records on this device only.
            The <strong>research coordinator</strong> can unlock the Data tab, sync all submitted records, then return here to run the full correlation analysis.
          </p>
        </div>
      )}

      {/* Descriptive stats */}
      {stats && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Descriptive Statistics
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatBox label="Mean Workload" value={`${stats.desc.workload.mean.toFixed(1)}%`} sub={`SD ± ${stats.desc.workload.sd.toFixed(1)}`} />
            <StatBox label="Median Workload" value={`${stats.desc.workload.median.toFixed(1)}%`} sub={`${stats.desc.workload.min}–${stats.desc.workload.max}`} />
            <StatBox label="Mean IPC Score" value={`${stats.desc.ipc.mean.toFixed(1)}%`} sub={`SD ± ${stats.desc.ipc.sd.toFixed(1)}`} />
            <StatBox label="Median IPC Score" value={`${stats.desc.ipc.median.toFixed(1)}%`} sub={`${stats.desc.ipc.min}–${stats.desc.ipc.max}`} />
          </div>
        </div>
      )}

      {/* Spearman correlation */}
      {stats && !needMore && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Spearman Rank Correlation — Workload vs IPC Compliance
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex gap-6 sm:gap-8 flex-shrink-0">
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-primary-700">
                  {stats.r.toFixed(3)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">ρ (rho)</p>
              </div>
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-gray-700">
                  {isNaN(stats.p) ? '—' : stats.p < 0.001 ? '<.001' : stats.p.toFixed(3)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">p-value</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {stats.r < -0.1 ? (
                  <TrendingDown size={18} className="text-red-500" />
                ) : stats.r > 0.1 ? (
                  <TrendingUp size={18} className="text-green-500" />
                ) : (
                  <Minus size={18} className="text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-800 capitalize">
                  {interpretCorrelation(stats.r)} correlation
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {!isNaN(stats.p) && stats.p < 0.05
                  ? `Statistically significant at α = 0.05 (n = ${records.length})`
                  : `Not statistically significant at α = 0.05 (n = ${records.length})`}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {stats.r < -0.1
                  ? 'Higher workload is associated with lower IPC compliance.'
                  : stats.r > 0.1
                  ? 'Higher workload is associated with higher IPC compliance.'
                  : 'No meaningful relationship detected between workload and IPC compliance.'}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-3 mt-3">
            Cohen (1988): |ρ| &lt;0.10 negligible · 0.10–0.29 weak · 0.30–0.49 moderate · 0.50–0.69 strong · ≥0.70 very strong.
          </p>
        </div>
      )}

      {needMore && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          Collect at least 3 records to compute the Spearman correlation coefficient.
        </div>
      )}

      {/* Scatter plot */}
      {records.length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
            Workload Score vs IPC Compliance Score
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 5, right: 10, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="x" type="number" domain={[0, 100]} tick={{ fontSize: 10 }}
                label={{ value: 'Workload (%)', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#6b7280' }}
              />
              <YAxis
                dataKey="y" type="number" domain={[0, 100]} tick={{ fontSize: 10 }} width={32}
                label={{ value: 'IPC (%)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 10, fill: '#6b7280' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-xl p-2.5 text-xs shadow-lg">
                      <p className="font-semibold">{d.name}</p>
                      <p>Workload: <strong>{d.x}%</strong></p>
                      <p>IPC: <strong>{d.y}%</strong></p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#2563eb">
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={CAT_COLOR[entry.wCat] ?? '#2563eb'} opacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            Dot colour = workload category (green=Low · yellow=Moderate · orange=High · red=Very High)
          </p>
        </div>
      )}

      {/* Category distribution */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Category Distribution</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={catBarData} margin={{ top: 5, right: 10, bottom: 36, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0} height={48} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="workload" name="Workload" fill="#2563eb" radius={[3, 3, 0, 0]} />
            <Bar dataKey="ipc" name="IPC" fill="#0d9488" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subscore averages */}
      {subscaleData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Average Subscale Scores</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subscaleData} margin={{ top: 5, right: 10, bottom: 48, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" interval={0} height={54} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip formatter={(v: number, _, props) => [`${v}%`, props.payload?.full ?? '']} />
              <Bar dataKey="avg" name="Mean (%)" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Records table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">All Records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="bg-gray-50">
                {['#', 'Code', 'Ward', 'Workload%', 'W Cat', 'IPC%', 'IPC Cat'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-gray-800">{r.demographics.nurseCode}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-28 truncate">
                    {r.demographics.ward.replace(' Ward', '').replace(' Unit', '')}
                  </td>
                  <td className="px-3 py-2 font-bold" style={{ color: CAT_COLOR[r.workloadCategory] }}>
                    {r.workloadScore}
                  </td>
                  <td className="px-3 py-2" style={{ color: CAT_COLOR[r.workloadCategory] }}>
                    {r.workloadCategory}
                  </td>
                  <td className="px-3 py-2 font-bold" style={{ color: CAT_COLOR[r.ipcCategory] }}>
                    {r.ipcScore}
                  </td>
                  <td className="px-3 py-2" style={{ color: CAT_COLOR[r.ipcCategory] }}>
                    {r.ipcCategory}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
