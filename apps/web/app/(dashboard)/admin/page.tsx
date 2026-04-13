'use client';

import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/auth/store';

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    enabled: isAdmin,
  });

  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.users(),
    enabled: isAdmin,
  });

  const rooms = useQuery({
    queryKey: ['admin', 'rooms'],
    queryFn: () => adminApi.rooms(),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <Shield className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          this page is only accessible to administrators.
        </p>
      </div>
    );
  }

  const s = stats.data?.stats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          system overview. users, rooms, and basic metrics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="users" value={s?.userCount} loading={stats.isLoading} />
        <StatCard label="rooms" value={s?.roomCount} loading={stats.isLoading} />
        <StatCard label="sessions" value={s?.sessionCount} loading={stats.isLoading} />
        <StatCard label="memberships" value={s?.membershipCount} loading={stats.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>users</CardTitle>
            <CardDescription>
              {users.data ? `${users.data.total} total` : 'loading...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users.isLoading ? (
              <p className="text-sm text-muted-foreground">loading users...</p>
            ) : users.error ? (
              <p className="text-sm text-destructive">could not load users.</p>
            ) : (
              <div className="divide-y">
                {(users.data?.users ?? []).map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>rooms</CardTitle>
            <CardDescription>
              {rooms.data ? `${rooms.data.total} total` : 'loading...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms.isLoading ? (
              <p className="text-sm text-muted-foreground">loading rooms...</p>
            ) : rooms.error ? (
              <p className="text-sm text-destructive">could not load rooms.</p>
            ) : (
              <div className="divide-y">
                {(rooms.data?.rooms ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.memberCount} {r.memberCount === 1 ? 'member' : 'members'} · {r.inviteCode}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-2xl">
          {loading ? '...' : value?.toLocaleString() ?? '0'}
        </p>
      </CardContent>
    </Card>
  );
}
