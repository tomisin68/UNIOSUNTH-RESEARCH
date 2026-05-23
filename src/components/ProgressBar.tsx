interface ProgressBarProps {
  step: number;
  total: number;
  labels: string[];
}

export default function ProgressBar({ step, total, labels }: ProgressBarProps) {
  const pct = Math.round(((step - 1) / (total - 1)) * 100);

  return (
    <div className="mb-5">
      {/* Step dots — desktop */}
      <div className="hidden sm:flex justify-between mb-2">
        {labels.map((label, i) => {
          const done = i + 1 < step;
          const active = i + 1 === step;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : active
                    ? 'bg-white border-primary-600 text-primary-600'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  active ? 'text-primary-700' : done ? 'text-primary-500' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Track */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-600 transition-all duration-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Mobile label */}
      <div className="sm:hidden flex justify-between items-center mt-1.5">
        <span className="text-xs font-medium text-primary-700">{labels[step - 1]}</span>
        <span className="text-xs text-gray-400">
          {step} / {total}
        </span>
      </div>
    </div>
  );
}
