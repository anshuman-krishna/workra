// shared heatmap scale used by the room and dashboard calendars.
// the intensity buckets are driven by the busiest day in the visible range so the
// scale always has contrast regardless of workload. the classes below reference
// tailwind utility classes already available in the design tokens.

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

// return a 0-4 bucket for a given duration, relative to the clamp in the range
export function heatLevel(durationMs: number, clampMs: number): HeatLevel {
  if (durationMs <= 0 || clampMs <= 0) return 0;
  const ratio = Math.min(1, durationMs / clampMs);
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

// computes a stable clamp for the heat scale. a naive max-of-range lets one
// all-nighter flatten every other day into the lowest bucket, so we take the
// p90 of non-zero days and fall back to the true max when the sample is thin.
// this keeps the scale responsive for ordinary weeks and still accommodates
// genuinely heavy days.
export function heatClamp(durations: number[]): number {
  const active = durations.filter((d) => d > 0);
  if (active.length === 0) return 0;
  if (active.length < 5) return Math.max(...active);
  const sorted = [...active].sort((a, b) => a - b);
  const p90Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  const p90 = sorted[p90Index];
  const max = sorted[sorted.length - 1];
  // never let the clamp fall below p90 or above 1.5x p90, so outliers saturate
  // without compressing the rest of the scale.
  return Math.min(max, Math.max(p90, Math.round(p90 * 1.5)));
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
