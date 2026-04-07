/**
 * Formats an ETA value (in minutes) into a human-readable display pair.
 *
 *  < 60 min  →  { primary: "45",   secondary: "min" }
 *  ≥ 60 min  →  { primary: "1 hr", secondary: "15 min" }  (or null when exact hour)
 *
 * The primary string is always short so it fits inside a narrow grid cell at
 * large font size; the secondary string renders as a smaller suffix.
 */
export function formatEta(minutes: number): { primary: string; secondary: string | null } {
  const rounded = Math.round(minutes);

  if (rounded < 60) {
    return { primary: String(rounded), secondary: "min" };
  }

  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return {
    primary: `${hrs} hr`,
    secondary: mins > 0 ? `${mins} min` : null,
  };
}
