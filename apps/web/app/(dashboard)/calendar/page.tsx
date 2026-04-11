'use client';

import { DashboardCalendar } from '@/components/calendar/dashboard-calendar';

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          your time across every room, in one view. the last twelve months of work.
        </p>
      </div>
      <DashboardCalendar />
    </div>
  );
}
