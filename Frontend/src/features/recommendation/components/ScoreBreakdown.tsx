import type { ScoreBreakdown as ScoreBreakdownType } from "../../../types/recommendation.types";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
}

const MAX_SCORES = {
  cost: 40,
  distance: 25,
  preferences: 15,
  major: 10,
  verified: 10,
  event: 15
};

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="w-full pt-2">
      {Object.entries(MAX_SCORES).map(([key, max]) => (
        <div key={key} className="flex items-center gap-2 mb-1.5">
          <div className="w-[88px] text-[10px] text-text2">
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </div>
          <div className="flex-1 h-[3.5px] bg-bg2 rounded overflow-hidden">
            <div
              className="h-full bg-maroon rounded transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(1, (breakdown[key as keyof ScoreBreakdownType] || 0) / max)) * 100}%` }}
            />
          </div>
          <div className="w-[22px] text-[10px] font-bold text-maroon text-right">
            {breakdown[key as keyof ScoreBreakdownType] ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
}
