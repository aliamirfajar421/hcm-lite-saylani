"use client";

export default function AiBadge({
  toolsCalled,
  fallbackUsed,
}: {
  toolsCalled?: string[];
  fallbackUsed?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300 border border-teal-500/30">
        ✦ AI-generated
      </span>
      {toolsCalled &&
        toolsCalled.length > 0 &&
        toolsCalled.map((tool, i) => (
          <span
            key={`${tool}-${i}`}
            className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-mono text-muted border border-[var(--border-color)]"
          >
            ⚙ {tool}
          </span>
        ))}
      {fallbackUsed && (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          scoped-engine
        </span>
      )}
    </div>
  );
}

