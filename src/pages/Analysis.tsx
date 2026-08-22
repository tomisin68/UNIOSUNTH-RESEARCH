import { useMemo, useRef, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, PieChart, Pie, ReferenceLine, LabelList,
} from 'recharts';
import {
  TrendingDown, TrendingUp, Minus, Loader2, AlertTriangle, Download, FileText,
  Table2, Database, Printer, ChevronDown, Info,
} from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { buildAnalysis, ALPHA, type AnalysisModel, type ScaleAnalysis, type HypothesisResult, type Conclusion } from '../utils/analysisModel';
import {
  formatNumber, formatP, interpretCorrelation,
  type Descriptives, type FrequencyRow, type KruskalWallisResult,
} from '../utils/statistics';
import {
  captureCharts, downloadAnalysisReport, printAnalysisReport,
  downloadStatisticsCSV, downloadDataCSV,
} from '../utils/report';
import { shortWard } from '../data/wards';

const BAND_COLOR: Record<string, string> = {
  Low: '#16a34a', Moderate: '#ca8a04', High: '#ea580c', 'Very High': '#dc2626',
  Optimal: '#16a34a', Satisfactory: '#2563eb', Suboptimal: '#ca8a04', Poor: '#dc2626',
};

const SECTIONS = [
  { id: 'sample', label: 'Sample' },
  { id: 'workload', label: 'Objective 1' },
  { id: 'ipc', label: 'Objective 2' },
  { id: 'relationship', label: 'Relationship' },
  { id: 'hypotheses', label: 'Hypotheses' },
  { id: 'conclusions', label: 'Conclusions' },
];

// ── Presentational building blocks ────────────────────────────────────────

function Section({ id, title, subtitle, children }: {
  id: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3">
        <h3 className="text-sm sm:text-base font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="space-y-3 sm:space-y-4">{children}</div>
    </section>
  );
}

function Card({ title, children, className = '' }: {
  title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 ${className}`}>
      {title && (
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      )}
      {children}
    </div>
  );
}

/** Charts are tagged so the report generator can lift them out of the page. */
function ChartFrame({ title, height = 240, children }: {
  title: string; height?: number; children: React.ReactElement;
}) {
  return (
    <Card title={title}>
      <div data-chart={title}>
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function DataTable({ headers, rows, dense = false }: {
  headers: string[]; rows: (string | number)[][]; dense?: boolean;
}) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <table className={`w-full ${dense ? 'text-[11px]' : 'text-xs'} min-w-[420px]`}>
        <thead>
          <tr className="bg-gray-50">
            {headers.map(h => (
              <th key={h} className="text-left px-2.5 py-2 font-semibold text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className={`px-2.5 py-2 ${j === 0 ? 'text-gray-700 font-medium' : 'text-gray-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DESCRIPTIVE_HEADERS = [
  'Variable', 'n', 'Mean', 'SD', 'SEM', '95% CI', 'Median', 'Q1', 'Q3', 'IQR',
  'Min', 'Max', 'Skew', 'Kurt', 'CV %',
];

function descriptiveRow(label: string, d: Descriptives): (string | number)[] {
  return [
    label, d.n, formatNumber(d.mean), formatNumber(d.sd), formatNumber(d.sem),
    `${formatNumber(d.ci95Lower)}–${formatNumber(d.ci95Upper)}`,
    formatNumber(d.median), formatNumber(d.q1), formatNumber(d.q3), formatNumber(d.iqr),
    formatNumber(d.min, 0), formatNumber(d.max, 0),
    formatNumber(d.skewness), formatNumber(d.kurtosis), formatNumber(d.cv, 1),
  ];
}

function frequencyRows(rows: FrequencyRow[]): (string | number)[][] {
  return rows.map(r => [r.label, r.count, `${r.percent.toFixed(1)}%`]);
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
      <p className="text-lg sm:text-xl font-bold text-gray-800">{value}</p>
      <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function KruskalCard({ title, result }: { title: string; result: KruskalWallisResult }) {
  if (!result.groups.length) {
    return (
      <Card title={title}>
        <p className="text-xs text-gray-400">
          Not enough records in two or more groups to run this comparison yet.
        </p>
      </Card>
    );
  }
  const significant = result.p < ALPHA;
  return (
    <Card title={title}>
      <DataTable
        headers={['Group', 'n', 'Mean', 'SD', 'Median', 'Mean rank']}
        rows={result.groups.map(g => [
          g.label, g.n, formatNumber(g.mean, 1), formatNumber(g.sd, 1),
          formatNumber(g.median, 1), formatNumber(g.meanRank, 1),
        ])}
        dense
      />
      <p className="text-xs mt-3 pt-3 border-t border-gray-100">
        <span className="font-bold text-gray-700">
          H({result.df}) = {formatNumber(result.h)}, p {formatP(result.p)}
        </span>{' '}
        <span className={significant ? 'text-green-700 font-medium' : 'text-gray-500'}>
          {significant
            ? '— groups differ significantly'
            : '— no significant difference between groups'}
        </span>
      </p>
    </Card>
  );
}

function ScaleSection({ scale, id, title, subtitle, palette }: {
  scale: ScaleAnalysis; id: string; title: string; subtitle: string; palette: string[];
}) {
  const d = scale.descriptives;
  const bandData = scale.bands.filter(b => b.count > 0);

  return (
    <Section id={id} title={title} subtitle={subtitle}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatBox label="Mean score" value={`${formatNumber(d.mean, 1)}%`} sub={`SD ± ${formatNumber(d.sd, 1)}`} />
        <StatBox label="Median (IQR)" value={`${formatNumber(d.median, 1)}%`} sub={`IQR ${formatNumber(d.iqr, 1)}`} />
        <StatBox label="Mean item score" value={formatNumber(scale.itemMean)} sub={scale.responseRange} />
        <StatBox label="Cronbach's α" value={formatNumber(scale.alpha, 3)} sub={scale.alphaVerdict} />
      </div>

      <Card title="Full descriptive statistics">
        <DataTable
          headers={DESCRIPTIVE_HEADERS}
          rows={[
            descriptiveRow('Score (0–100)', d),
            descriptiveRow(`Raw total (${scale.rawMin}–${scale.rawMax})`, scale.rawDescriptives),
            ...scale.subscales.map(s => descriptiveRow(s.name, s.descriptives)),
          ]}
          dense
        />
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          {scale.normality.applicable
            ? `Normality (D'Agostino–Pearson): K² = ${formatNumber(scale.normality.k2)}, p ${formatP(scale.normality.p)} — scores are ${scale.normality.normal ? 'consistent with' : 'not consistent with'} a normal distribution.`
            : `A formal normality test needs at least 20 records (n = ${scale.normality.n}).`}
          {' '}Non-parametric tests are used throughout.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <ChartFrame title={`${title.split('— ')[1] ?? title} — distribution of bands`} height={230}>
          <PieChart>
            <Pie
              data={bandData}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={72}
              label={({ label, percent }: { label?: string; percent?: number }) =>
                `${label} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {bandData.map(b => (
                <Cell key={b.label} fill={BAND_COLOR[b.label] ?? palette[0]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${v} nurses`, n]} />
          </PieChart>
        </ChartFrame>

        <ChartFrame title={`${title.split('— ')[1] ?? title} — subscale means`} height={230}>
          <BarChart
            data={scale.subscales.map(s => ({
              name: s.name.split(' ').slice(0, 2).join(' '),
              full: s.name,
              mean: Math.round(s.descriptives.mean * 10) / 10,
            }))}
            margin={{ top: 8, right: 10, bottom: 44, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-22} textAnchor="end" interval={0} height={52} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
            <Tooltip formatter={(v: number, _n, p) => [`${v}%`, p?.payload?.full ?? '']} />
            <Bar dataKey="mean" name="Mean %" fill={palette[1]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartFrame>
      </div>

      <Card title="Band frequencies">
        <DataTable headers={['Band', 'Frequency', 'Percent']} rows={frequencyRows(scale.bands)} />
      </Card>

      <Card title="Item-level statistics">
        <DataTable
          headers={['#', 'Item', 'Subscale', 'Mean', 'SD']}
          rows={scale.items.map(i => [
            i.id,
            i.text.length > 84 ? `${i.text.slice(0, 84)}…` : i.text,
            i.subscale.split(' ').slice(0, 2).join(' '),
            formatNumber(i.mean),
            formatNumber(i.sd),
          ])}
          dense
        />
        <p className="text-[11px] text-gray-400 mt-2">
          Reverse-keyed items are shown after inversion, so a higher mean always means more of
          the construct.
        </p>
      </Card>

      <KruskalCard title="By service area" result={scale.byWardGroup} />
      <KruskalCard title="By ward" result={scale.byWard} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <KruskalCard title="By shift" result={scale.byShift} />
        <KruskalCard title="By qualification" result={scale.byQualification} />
      </div>
    </Section>
  );
}

function HypothesisCard({ hypothesis }: { hypothesis: HypothesisResult }) {
  const { decision } = hypothesis;
  const chip = decision === 'Reject'
    ? 'bg-green-100 text-green-800'
    : decision === 'Retain'
      ? 'bg-gray-200 text-gray-700'
      : 'bg-amber-100 text-amber-800';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="text-xs font-bold text-primary-700">{hypothesis.id}</span>
          <span className="text-xs text-gray-400 ml-2">{hypothesis.test}</span>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${chip}`}>
          {decision === 'Reject' ? 'REJECT H₀' : decision === 'Retain' ? 'RETAIN H₀' : 'NOT TESTABLE'}
        </span>
      </div>

      <p className="text-xs text-gray-700 leading-relaxed mb-1.5">
        <span className="font-bold">H₀:</span> {hypothesis.nullHypothesis}
      </p>
      <p className="text-xs text-gray-600 leading-relaxed mb-3">
        <span className="font-bold">H₁:</span> {hypothesis.alternativeHypothesis}
      </p>

      <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 mb-2">
        {hypothesis.statisticLabel} = {formatNumber(hypothesis.statistic, 3)}
        {hypothesis.df !== null && `, df = ${hypothesis.df}`}
        , n = {hypothesis.n}, p {formatP(hypothesis.p)}
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{hypothesis.conclusion}</p>
    </Card>
  );
}

function ConclusionCard({ conclusion }: { conclusion: Conclusion }) {
  const data = conclusion.data.filter(d => d.value > 0 || conclusion.chartType === 'bar');

  return (
    <Card className="border-l-4 border-l-primary-600">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-bold text-white bg-primary-600 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
          {conclusion.number}
        </span>
        <p className="text-xs font-semibold text-gray-500">{conclusion.question}</p>
      </div>

      <p className="text-sm sm:text-base font-bold text-primary-800 mt-2 mb-1.5 leading-snug">
        {conclusion.headline}
      </p>
      <p className="text-xs text-gray-600 leading-relaxed mb-3">{conclusion.narrative}</p>

      <div data-chart={conclusion.chartLabel}>
        <ResponsiveContainer width="100%" height={220}>
          {conclusion.chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ label, percent }: { label?: string; percent?: number }) =>
                  `${label} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={BAND_COLOR[d.label] ?? conclusion.palette[i % conclusion.palette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [`${v} nurses`, n]} />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 16, right: 10, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
              <Tooltip formatter={(v: number, _n, p) => [`${v}%`, p?.payload?.detail ?? '']} />
              <Bar dataKey="value" name="Mean IPC %" radius={[3, 3, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={d.label} fill={BAND_COLOR[d.label] ?? conclusion.palette[i % conclusion.palette.length]} />
                ))}
                <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: '#6b7280' }} />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-1">{conclusion.chartLabel}</p>
    </Card>
  );
}

// ── Download menu ─────────────────────────────────────────────────────────

function DownloadMenu({ model, getCharts, records }: {
  model: AnalysisModel;
  getCharts: () => ReturnType<typeof captureCharts>;
  records: Parameters<typeof downloadDataCSV>[0];
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  function run(action: () => void, note: string) {
    action();
    setOpen(false);
    setMessage(note);
    setTimeout(() => setMessage(''), 4000);
  }

  const items = [
    {
      icon: Printer,
      label: 'Analysis report (print / PDF)',
      hint: 'Opens the full written report ready to save as PDF',
      onClick: () => run(() => {
        const opened = printAnalysisReport(model, getCharts());
        if (!opened) setMessage('Allow pop-ups for this site to print the report.');
      }, 'Report opened in a new tab.'),
    },
    {
      icon: FileText,
      label: 'Analysis report (HTML file)',
      hint: 'Downloads the same report as a file that opens in Word',
      onClick: () => run(() => downloadAnalysisReport(model, getCharts()), 'Report downloaded.'),
    },
    {
      icon: Table2,
      label: 'Statistics (CSV)',
      hint: 'Every table in this page as a spreadsheet',
      onClick: () => run(() => downloadStatisticsCSV(model), 'Statistics downloaded.'),
    },
    {
      icon: Database,
      label: 'Raw data (CSV)',
      hint: 'One row per participant with every item response, for SPSS or R',
      onClick: () => run(() => downloadDataCSV(records), 'Data downloaded.'),
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-primary-700 active:bg-primary-800 touch-manipulation shadow-sm"
      >
        <Download size={15} />
        Download Analysis
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-40 overflow-hidden">
            {items.map(({ icon: Icon, label, hint, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 flex gap-3 border-b border-gray-100 last:border-0 touch-manipulation"
              >
                <Icon size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-gray-800">{label}</span>
                  <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {message && (
        <p className="absolute right-0 top-full mt-2 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1 whitespace-nowrap">
          {message}
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function Analysis() {
  const { records, all, loading, error, configured } = useRecords();
  const containerRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () => buildAnalysis(records, all.length),
    [records, all.length],
  );

  if (!configured) {
    return (
      <div className="text-center py-16 sm:py-24">
        <AlertTriangle size={40} className="mx-auto text-red-300 mb-3" />
        <h3 className="text-gray-600 font-medium">Study database not configured</h3>
        <p className="text-sm text-gray-400 mt-1">
          The analysis reads directly from the database; there is no local data to fall back on.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16 sm:py-24">
        <Loader2 size={32} className="mx-auto text-primary-400 mb-3 animate-spin" />
        <p className="text-sm text-gray-400">Loading the study database…</p>
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

  if (!records.length) {
    return (
      <div className="text-center py-16 sm:py-24">
        <TrendingDown size={40} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-gray-500 font-medium">No data to analyse</h3>
        <p className="text-sm text-gray-400 mt-1">
          Submitted assessments feed this page automatically.
        </p>
      </div>
    );
  }

  const { association, crossTab } = model;
  const rho = association.spearman.coefficient;
  const significant = association.spearman.p < ALPHA;

  const wardChartData = model.sample.ward
    .filter(r => r.count > 0)
    .map(r => ({ name: shortWard(r.label), count: r.count }));

  const regressionLine = Number.isFinite(association.regression.slope)
    ? [
      { x: 0, y: association.regression.intercept },
      { x: 100, y: association.regression.intercept + association.regression.slope * 100 },
    ]
    : null;

  return (
    <div ref={containerRef} className="space-y-6 sm:space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">
            Analysis —{' '}
            <span className="text-primary-600">
              {model.n} record{model.n !== 1 ? 's' : ''}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Live from the study database
            {model.excludedCount > 0 && ` • ${model.excludedCount} record(s) excluded`}
            {' '}• α = {ALPHA}
          </p>
        </div>
        <DownloadMenu
          model={model}
          getCharts={() => captureCharts(containerRef.current)}
          records={records}
        />
      </div>

      {/* ── Jump nav ───────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
        {SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-primary-400 hover:text-primary-700 transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>

      {!model.sufficient && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
          <Info size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Descriptive statistics are shown for all {model.n} records. The hypothesis tests are
            reported once at least {model.minimumN} assessments have been submitted, below which
            a p-value would be unstable.
          </p>
        </div>
      )}

      {/* ── Research questions ─────────────────────────────────────────── */}
      <Card className="bg-primary-50 border-primary-200">
        <p className="text-xs font-bold text-primary-900 uppercase tracking-wide mb-2">
          What this analysis answers
        </p>
        <ol className="space-y-1.5 text-xs text-primary-900 leading-relaxed list-decimal list-inside">
          <li>To assess nursing workload among nurses in UNIOSUN Teaching Hospital.</li>
          <li>
            To assess compliance with infection prevention and control practices among nurses in
            UNIOSUN Teaching Hospital.
          </li>
        </ol>
        <p className="text-xs text-primary-800 leading-relaxed mt-2.5 pt-2.5 border-t border-primary-200">
          <strong>H₀:</strong> There is no statistically significant relationship between nursing
          workload and compliance with infection prevention and control practices among nurses in
          UNIOSUN Teaching Hospital.{' '}
          <strong>H₁:</strong> There is a statistically significant relationship between the two.
        </p>
      </Card>

      {/* ── Sample ─────────────────────────────────────────────────────── */}
      <Section
        id="sample"
        title="1. Characteristics of the sample"
        subtitle="Who submitted, and from where."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatBox label="Nurses assessed" value={String(model.n)} />
          <StatBox label="Wards represented" value={String(model.sample.ward.filter(w => w.count > 0).length)} />
          <StatBox
            label="Mean experience"
            value={`${formatNumber(model.sample.experience.mean, 1)} yr`}
            sub={`SD ± ${formatNumber(model.sample.experience.sd, 1)}`}
          />
          <StatBox
            label="Mean patient load"
            value={formatNumber(model.sample.patientLoad.mean, 1)}
            sub={`SD ± ${formatNumber(model.sample.patientLoad.sd, 1)}`}
          />
        </div>

        <ChartFrame title="Records by ward" height={Math.max(200, wardChartData.length * 22 + 40)}>
          <BarChart data={wardChartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} interval={0} />
            <Tooltip formatter={(v: number) => [`${v} nurses`, 'Records']} />
            <Bar dataKey="count" fill="#2563eb" radius={[0, 3, 3, 0]}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#6b7280' }} />
            </Bar>
          </BarChart>
        </ChartFrame>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card title="Service area">
            <DataTable headers={['Service area', 'n', '%']} rows={frequencyRows(model.sample.wardGroup)} />
          </Card>
          <Card title="Shift">
            <DataTable headers={['Shift', 'n', '%']} rows={frequencyRows(model.sample.shift)} />
          </Card>
          <Card title="Qualification">
            <DataTable headers={['Qualification', 'n', '%']} rows={frequencyRows(model.sample.qualification)} />
          </Card>
          <Card title="Years of experience">
            <DataTable headers={['Band', 'n', '%']} rows={frequencyRows(model.sample.experienceBand)} />
          </Card>
          <Card title="Patients this shift">
            <DataTable headers={['Band', 'n', '%']} rows={frequencyRows(model.sample.patientLoadBand)} />
          </Card>
          <Card title="Ward">
            <DataTable headers={['Ward', 'n', '%']} rows={frequencyRows(model.sample.ward.filter(w => w.count > 0))} dense />
          </Card>
        </div>

        <Card title="Demographic variables — descriptives">
          <DataTable
            headers={DESCRIPTIVE_HEADERS}
            rows={[
              descriptiveRow('Years of experience', model.sample.experience),
              descriptiveRow('Patients this shift', model.sample.patientLoad),
            ]}
            dense
          />
        </Card>
      </Section>

      {/* ── Objective 1 ────────────────────────────────────────────────── */}
      <ScaleSection
        scale={model.workload}
        id="workload"
        title="2. Objective 1 — Nursing workload"
        subtitle="To assess nursing workload among nurses in UNIOSUN Teaching Hospital."
        palette={['#2563eb', '#2563eb']}
      />

      {/* ── Objective 2 ────────────────────────────────────────────────── */}
      <ScaleSection
        scale={model.ipc}
        id="ipc"
        title="3. Objective 2 — IPC compliance"
        subtitle="To assess compliance with infection prevention and control practices among nurses in UNIOSUN Teaching Hospital."
        palette={['#0d9488', '#0d9488']}
      />

      {/* ── Relationship ───────────────────────────────────────────────── */}
      <Section
        id="relationship"
        title="4. Relationship between workload and IPC compliance"
        subtitle="Spearman's rank-order correlation is the primary test; the rest is reported alongside it."
      >
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex gap-6 sm:gap-8 flex-shrink-0">
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-primary-700">
                  {formatNumber(rho, 3)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">ρ (rho)</p>
              </div>
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-gray-700">
                  {formatP(association.spearman.p).replace('= ', '')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">p-value</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {rho < -0.1 ? (
                  <TrendingDown size={18} className="text-red-500" />
                ) : rho > 0.1 ? (
                  <TrendingUp size={18} className="text-green-500" />
                ) : (
                  <Minus size={18} className="text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-800 capitalize">
                  {interpretCorrelation(rho)} correlation
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {significant
                  ? `Statistically significant at α = ${ALPHA} (n = ${model.n})`
                  : `Not statistically significant at α = ${ALPHA} (n = ${model.n})`}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {rho < -0.1
                  ? 'Higher workload is associated with lower IPC compliance.'
                  : rho > 0.1
                    ? 'Higher workload is associated with higher IPC compliance.'
                    : 'No meaningful relationship detected between workload and IPC compliance.'}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-3 mt-3">
            Cohen (1988): |ρ| &lt;0.10 negligible · 0.10–0.29 weak · 0.30–0.49 moderate ·
            0.50–0.69 strong · ≥0.70 very strong.
          </p>
        </Card>

        <ChartFrame title="Workload score vs IPC compliance score" height={260}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 26, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="workload" type="number" domain={[0, 100]} tick={{ fontSize: 10 }}
              label={{ value: 'Workload (%)', position: 'insideBottom', offset: -14, fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis
              dataKey="ipc" type="number" domain={[0, 100]} tick={{ fontSize: 10 }} width={32}
              label={{ value: 'IPC (%)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 10, fill: '#6b7280' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-xl p-2.5 text-xs shadow-lg">
                    <p className="font-semibold">{d.code}</p>
                    <p className="text-gray-500">{d.ward}</p>
                    <p>Workload: <strong>{d.workload}%</strong></p>
                    <p>IPC: <strong>{d.ipc}%</strong></p>
                  </div>
                );
              }}
            />
            {regressionLine && (
              <ReferenceLine
                segment={regressionLine}
                stroke="#1e3a8a"
                strokeWidth={2}
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
              />
            )}
            <Scatter data={model.scatter} fill="#2563eb">
              {model.scatter.map((entry, i) => (
                <Cell key={i} fill={BAND_COLOR[entry.band] ?? '#2563eb'} opacity={0.75} />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartFrame>
        <p className="text-[10px] text-gray-400 text-center -mt-2">
          Dot colour = workload band. Dashed line = least-squares fit
          (IPC = {formatNumber(association.regression.intercept, 1)}
          {association.regression.slope < 0 ? ' − ' : ' + '}
          {formatNumber(Math.abs(association.regression.slope), 3)} × workload,
          R² = {formatNumber(association.regression.r2, 3)}).
        </p>

        <Card title="Correlation matrix">
          <DataTable
            headers={['Pair', 'Test', 'Coefficient', 'n', 'p']}
            rows={[
              ['Workload vs IPC compliance', "Spearman's ρ", formatNumber(association.spearman.coefficient, 3), association.spearman.n, formatP(association.spearman.p).replace('= ', '')],
              ['Workload vs IPC compliance', "Pearson's r", formatNumber(association.pearson.coefficient, 3), association.pearson.n, formatP(association.pearson.p).replace('= ', '')],
              ['Workload vs patients this shift', "Spearman's ρ", formatNumber(association.workloadVsPatientLoad.coefficient, 3), association.workloadVsPatientLoad.n, formatP(association.workloadVsPatientLoad.p).replace('= ', '')],
              ['Workload vs years of experience', "Spearman's ρ", formatNumber(association.workloadVsExperience.coefficient, 3), association.workloadVsExperience.n, formatP(association.workloadVsExperience.p).replace('= ', '')],
              ['IPC compliance vs years of experience', "Spearman's ρ", formatNumber(association.ipcVsExperience.coefficient, 3), association.ipcVsExperience.n, formatP(association.ipcVsExperience.p).replace('= ', '')],
            ]}
            dense
          />
        </Card>

        <Card title="Workload band × IPC compliance band">
          <DataTable
            headers={['Workload band', ...crossTab.colLabels, 'Total']}
            rows={crossTab.observed.map((row, i) => [
              crossTab.rowLabels[i], ...row, row.reduce((a, b) => a + b, 0),
            ])}
          />
          <p className="text-xs mt-3 pt-3 border-t border-gray-100 font-bold text-gray-700">
            χ²({crossTab.df}) = {formatNumber(crossTab.chiSquare)}, p {formatP(crossTab.p)},
            Cramér's V = {formatNumber(crossTab.cramersV, 3)}
          </p>
          {crossTab.expectedCountWarning && (
            <p className="text-[11px] text-amber-700 mt-1.5">
              More than 20% of cells have an expected count below 5 — read the χ² with caution at
              this sample size.
            </p>
          )}
        </Card>

        <Card title="Mean IPC compliance within each workload band">
          <DataTable
            headers={['Workload band', 'n', 'Mean IPC %', 'SD']}
            rows={model.ipcByWorkloadBand.map(r => [
              r.label, r.n, formatNumber(r.mean, 1), formatNumber(r.sd, 1),
            ])}
          />
        </Card>
      </Section>

      {/* ── Hypotheses ─────────────────────────────────────────────────── */}
      <Section
        id="hypotheses"
        title="5. Hypothesis testing"
        subtitle={`Each null hypothesis is rejected when p < ${ALPHA} and retained otherwise.`}
      >
        {model.hypotheses.map(h => (
          <HypothesisCard key={h.id} hypothesis={h} />
        ))}
      </Section>

      {/* ── Conclusions ────────────────────────────────────────────────── */}
      <Section
        id="conclusions"
        title="6. Conclusions"
        subtitle="One conclusion per research question, and one for the hypothesis."
      >
        {model.conclusions.map(c => (
          <ConclusionCard key={c.number} conclusion={c} />
        ))}
      </Section>

      {/* ── Records ────────────────────────────────────────────────────── */}
      <Card title={`All records analysed (${model.n})`}>
        <DataTable
          headers={['#', 'Code', 'Ward', 'Shift', 'Workload %', 'Band', 'IPC %', 'Band']}
          rows={records.map((r, i) => [
            i + 1,
            r.demographics.nurseCode,
            shortWard(r.demographics.ward),
            r.demographics.shift,
            r.workloadScore,
            r.workloadCategory,
            r.ipcScore,
            r.ipcCategory,
          ])}
          dense
        />
      </Card>
    </div>
  );
}
