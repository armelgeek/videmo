const PATHS = {
  "down-left": { vb: "0 0 110 80", line: "M100 6 C 80 30, 50 30, 22 62", head: "M20 44 L 20 64 L 40 62" },
  "down-right": { vb: "0 0 110 80", line: "M10 6 C 30 30, 60 30, 88 62", head: "M90 44 L 90 64 L 70 62" },
  "right": { vb: "0 0 120 70", line: "M6 10 C 40 60, 80 60, 108 34", head: "M92 30 L 110 32 L 104 50" },
  "curve-right": { vb: "0 0 300 90", line: "M40 8 C 60 70, 220 20, 250 78", head: "M232 70 L 251 80 L 256 60" },
  "curve-left": { vb: "0 0 300 90", line: "M260 8 C 240 70, 80 20, 50 78", head: "M68 70 L 49 80 L 44 60" },
} as const;

export function HandArrow({ variant = "right", className }: { variant?: keyof typeof PATHS; className?: string }) {
  const p = PATHS[variant];
  return (
    <svg className={`sk-arrow ${className ?? ""}`} viewBox={p.vb} aria-hidden="true">
      <path d={p.line} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d={p.head} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
