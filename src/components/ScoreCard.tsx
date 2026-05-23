interface ScoreCardProps {
  title: string;
  score: number;
  category: string;
  color: string;
  subscores: Record<string, number>;
}

const scoreStyles: Record<string, { bg: string; text: string; bar: string; badge: string }> = {
  Low:          { bg: 'bg-green-50',  text: 'text-green-700',  bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  Moderate:     { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  High:         { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  'Very High':  { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  Optimal:      { bg: 'bg-green-50',  text: 'text-green-700',  bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
  Satisfactory: { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  Suboptimal:   { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  Poor:         { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
};

export default function ScoreCard({ title, score, category, subscores }: ScoreCardProps) {
  const s = scoreStyles[category] ?? { bg: 'bg-gray-50', text: 'text-gray-700', bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700' };

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${s.bg} border-transparent`}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 leading-tight">{title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${s.badge}`}>
          {category}
        </span>
      </div>

      <div className={`text-4xl sm:text-5xl font-bold mb-2 ${s.text}`}>{score}%</div>

      <div className="h-2.5 bg-white/70 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full ${s.bar} transition-all duration-700 rounded-full`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="space-y-2">
        {Object.entries(subscores).map(([sub, val]) => (
          <div key={sub}>
            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
              <span className="truncate mr-2 leading-tight">{sub}</span>
              <span className="font-semibold flex-shrink-0">{val}%</span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div className={`h-full ${s.bar} opacity-60 rounded-full`} style={{ width: `${val}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
