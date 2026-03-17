import type { ScoreBreakdown as ScoreBreakdownType } from "../../../types/recommendation.types";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
}

const SCORE_CONFIG: { key: keyof ScoreBreakdownType; label: string; max: number }[] = [
  { key: "cost",        label: "Cost savings",            max: 40 },
  { key: "distance",    label: "Distance to campus",      max: 25 },
  { key: "preferences", label: "Matches your preferences", max: 15 },
  { key: "major",       label: "Near your major",         max: 10 },
  { key: "verified",    label: "Community verified",       max: 10 },
  { key: "event",       label: "Near your event",         max: 15 },
];

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="w-full pt-2 space-y-2">
      {SCORE_CONFIG.map(({ key, label, max }) => {
        const value = breakdown[key] ?? 0;
        const pct = Math.max(0, Math.min(1, value / max)) * 100;
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text2">{label}</span>
              <span className="text-[10px] font-bold text-maroon">
                {value} <span className="font-normal text-text3">/ {max} pts</span>
              </span>
            </div>
            <div className="h-[4px] bg-bg2 rounded overflow-hidden">
              <div
                className="h-full bg-maroon rounded transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
