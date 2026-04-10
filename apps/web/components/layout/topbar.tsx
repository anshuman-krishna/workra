'use client';

import { Timer, Search } from 'lucide-react';
import { UserMenu } from './user-menu';

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="search (coming soon)"
            disabled
            className="h-9 w-full rounded-md border border-input bg-muted/50 pl-9 pr-3 text-sm text-muted-foreground outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" />
          <span className="font-mono">00:00:00</span>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
