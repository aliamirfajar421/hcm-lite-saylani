"use client";

export function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const styles: Record<string, string> = {
    present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    finalized: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    late: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    probation: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    draft: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    half_day: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    missing_checkout: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    on_leave: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    holiday: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    absent: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    exited: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    high: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  };
  const cls =
    styles[s] || "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-color)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent = "teal",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "teal" | "amber" | "indigo" | "rose";
}) {
  const borderAccent = {
    teal: "border-t-teal-500",
    amber: "border-t-amber-500",
    indigo: "border-t-indigo-500",
    rose: "border-t-rose-500",
  }[accent];

  return (
    <div className={`surface-card rounded-xl border-t-4 ${borderAccent} p-4 shadow-xs`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function HorizontalBars({
  items,
  emptyText = "No records yet",
  valueSuffix = "",
}: {
  items: Array<{ label: string; value: number; sub?: string }>;
  emptyText?: string;
  valueSuffix?: string;
}) {
  if (!items || items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>;
  }
  const maxVal = Math.max(1, ...items.map((i) => Number(i.value) || 0));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = Math.min(100, Math.round(((Number(item.value) || 0) / maxVal) * 100));
        return (
          <div key={`${item.label}-${idx}`}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">{item.label}</span>
              <span className="font-mono text-muted">
                {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                {valueSuffix}
                {item.sub ? ` · ${item.sub}` : ""}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{ width: `${Math.max(pct, item.value > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AttendanceTrendSvg({
  points,
}: {
  points: Array<{ date: string; present: number; late: number; absent?: number }>;
}) {
  if (!points || points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No attendance activity recorded for this range yet.
      </p>
    );
  }

  const recent = points.slice(-14);
  const maxY = Math.max(4, ...recent.map((p) => (p.present || 0) + (p.late || 0)));
  const width = 520;
  const height = 160;
  const padX = 28;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const coords = recent.map((p, idx) => {
    const totalAttended = (p.present || 0) + (p.late || 0);
    const x =
      recent.length === 1
        ? width / 2
        : padX + (idx / (recent.length - 1)) * plotW;
    const y = padY + plotH - (totalAttended / maxY) * plotH;
    return { x, y, label: p.date.slice(5), totalAttended, late: p.late || 0 };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[300px] h-40">
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="currentColor"
          strokeOpacity="0.18"
        />
        {coords.length > 1 && (
          <polyline
            fill="none"
            stroke="#0d9488"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}
        {coords.map((c, idx) => (
          <g key={idx}>
            <circle cx={c.x} cy={c.y} r="4.5" fill="#0d9488" />
            <text
              x={c.x}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity="0.65"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

