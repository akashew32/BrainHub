export function ModeTabs<T extends string>({
  modes,
  value,
  onChange,
  accent,
}: {
  modes: readonly T[];
  value: T;
  onChange: (mode: T) => void;
  accent: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Game mode">
      {modes.map((mode) => (
        <button
          key={mode}
          className="btn capitalize"
          style={value === mode ? { borderColor: accent, color: accent } : undefined}
          onClick={() => onChange(mode)}
        >
          {mode.replaceAll("-", " ")}
        </button>
      ))}
    </div>
  );
}

export function AnalysisGrid({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-[#283345] bg-[#090d13] p-4">
          <p className="text-lg font-semibold">{value}</p>
          <p className="metric mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function PersistenceNotice({ message }: { message: string }) {
  return message ? (
    <p className="mt-4 text-sm text-[#fbbf24]" role="status">
      {message}
    </p>
  ) : null;
}
