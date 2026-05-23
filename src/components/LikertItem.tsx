interface LikertItemProps {
  id: number;
  text: string;
  labels: Record<number, string>;
  value: number | undefined;
  onChange: (id: number, value: number) => void;
  colorScheme?: 'blue' | 'teal';
  reversed?: boolean;
}

export default function LikertItem({
  id,
  text,
  labels,
  value,
  onChange,
  colorScheme = 'blue',
  reversed = false,
}: LikertItemProps) {
  const options = Object.entries(labels).map(([k, v]) => ({
    val: Number(k),
    label: v,
  }));

  const activeClass =
    colorScheme === 'teal'
      ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
      : 'bg-primary-600 border-primary-600 text-white shadow-sm';

  const hoverClass =
    colorScheme === 'teal'
      ? 'hover:border-teal-400 hover:text-teal-600 active:bg-teal-50'
      : 'hover:border-primary-400 hover:text-primary-600 active:bg-primary-50';

  return (
    <div
      className={`bg-white border rounded-xl p-4 mb-3 transition-colors ${
        value !== undefined ? 'border-gray-200' : 'border-gray-200'
      }`}
    >
      <div className="flex gap-3">
        {/* Number badge */}
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
          {id}
        </span>

        <div className="flex-1 min-w-0">
          {/* Question text */}
          <p className="text-sm text-gray-800 leading-snug mb-3">
            {text}
            {reversed && (
              <span className="ml-1.5 text-xs text-amber-600 font-medium">(R)</span>
            )}
          </p>

          {/* Response options — stacked on mobile, inline on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-none sm:flex sm:flex-wrap gap-2">
            {options.map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange(id, val)}
                className={`
                  w-full sm:w-auto flex items-center gap-2 sm:gap-1.5
                  px-4 sm:px-3 py-3 sm:py-1.5
                  text-sm sm:text-xs rounded-xl sm:rounded-lg border font-medium
                  transition-all touch-manipulation select-none
                  ${value === val ? activeClass : `bg-white border-gray-200 text-gray-600 ${hoverClass}`}
                `}
              >
                {/* On mobile: show circle indicator */}
                <span
                  className={`sm:hidden flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    value === val
                      ? colorScheme === 'teal'
                        ? 'border-white bg-white/30'
                        : 'border-white bg-white/30'
                      : 'border-gray-300'
                  }`}
                >
                  {value === val && (
                    <span className="w-2 h-2 rounded-full bg-white block" />
                  )}
                </span>
                <span>
                  <span className="font-bold">{val}</span>
                  <span className="mx-1 opacity-50">—</span>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
