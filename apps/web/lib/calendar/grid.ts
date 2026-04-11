// builds a 6x7 calendar grid for a given month. days from the previous/next month
// fill the leading/trailing slots so the grid is always exactly 42 cells, which keeps
// the layout stable across months (no jitter when switching).

import { localDateKey } from '@/lib/format/time';

export interface GridDay {
  date: Date;
  key: string;
  inMonth: boolean;
}

// week starts on sunday. if we later want locale awareness this is the place to add it.
export function buildMonthGrid(year: number, monthIndex: number): GridDay[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startOffset);

  const cells: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      key: localDateKey(d),
      inMonth: d.getMonth() === monthIndex,
    });
  }
  return cells;
}

// yyyy-mm-dd bounds for the month grid (42 days), used as calendar query range
export function monthGridBounds(year: number, monthIndex: number): { from: string; to: string } {
  const grid = buildMonthGrid(year, monthIndex);
  return { from: grid[0].key, to: grid[grid.length - 1].key };
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}
