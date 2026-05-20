import type { ScoreBreakdown as ScoreBreakdownType } from "../../../types/recommendation.types";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
}

const SCORE_CONFIG: { key: keyof ScoreBreakdownType; label: string; max: number; tooltip: string }[] = [
  { key: "cost",        label: "Cost savings",             max: 40, tooltip: "Free parking scores highest; ≥ $5.00/hr scores 0 pts" },
  { key: "distance",    label: "Distance to campus",       max: 25, tooltip: "Display only — shows distance to destination, does not affect ranking" },
  { key: "travel_time", label: "Travel time to spot",      max: 15, tooltip: "Drives ranking — faster drive/walk time scores higher" },
  { key: "preferences", label: "Matches your preferences", max: 10, tooltip: "Matches your saved parking type preference" },
  { key: "major",       label: "Near your major",          max: 5,  tooltip: "Spot is on the same campus side as your declared major" },
  { key: "verified",    label: "Community verified",        max: 5,  tooltip: "Community-verified spots rank above unverified ones" },
  { key: "event",       label: "Near your event",          max: 15, tooltip: "Bonus when a spot is near an active campus event" },
];

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="w-full pt-2 space-y-2">
      {SCORE_CONFIG.map(({ key, label, max, tooltip }) => {
        const value = breakdown[key] ?? 0;
        const pct = Math.max(0, Math.min(1, value / max)) * 100;
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text2" title={tooltip}>{label}</span>
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
