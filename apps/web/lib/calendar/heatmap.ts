// shared heatmap scale used by the room and dashboard calendars.
// the intensity buckets are driven by the busiest day in the visible range so the
// scale always has contrast regardless of workload. the classes below reference
// tailwind utility classes already available in the design tokens.

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

// return a 0-4 bucket for a given duration, relative to the max in the range
export function heatLevel(durationMs: number, maxMs: number): HeatLevel {
  if (durationMs <= 0 || maxMs <= 0) return 0;
  const ratio = durationMs / maxMs;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

// neutral pastel greys mapping to the 5 heat levels.
// avoids the bright neon of a typical contribution graph while still being legible.
export const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: 'bg-muted/40',
  1: 'bg-foreground/15',
  2: 'bg-foreground/30',
  3: 'bg-foreground/55',
  4: 'bg-foreground/80',
};
