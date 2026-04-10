'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { slug: '', label: 'overview' },
  { slug: 'tasks', label: 'tasks' },
  { slug: 'time', label: 'time' },
  { slug: 'files', label: 'files' },
  { slug: 'calendar', label: 'calendar' },
  { slug: 'chat', label: 'chat' },
];

export function RoomTabs({ roomId }: { roomId: string }) {
  const pathname = usePathname();
  const base = `/rooms/${roomId}`;

  return (
    <nav className="border-b">
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = tab.slug
            ? pathname.startsWith(href)
            : pathname === base;
          return (
            <li key={tab.slug || 'overview'}>
              <Link
                href={href}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-4 text-sm transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
