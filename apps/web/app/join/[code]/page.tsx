'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { joinRoomSchema } from '@workra/shared';
import { roomsApi } from '@/lib/api/rooms';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import { Button } from '@/components/ui/button';

export default function JoinByCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);

  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const rawCode = params.code ?? '';
  const parsed = joinRoomSchema.safeParse({ code: rawCode });

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      const next = encodeURIComponent(`/join/${rawCode}`);
      router.replace(`/login?next=${next}`);
      return;
    }

    if (!parsed.success) {
      setError('that invite link does not look right.');
      return;
    }

    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const { room } = await roomsApi.join({ code: parsed.data.code });
        await qc.invalidateQueries({ queryKey: ['rooms'] });
        router.replace(`/rooms/${room.id}`);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) setError('this invite code does not match any room.');
          else setError(err.message);
        } else {
          setError('could not join room.');
        }
      }
    })();
  }, [hydrated, user, parsed.success, parsed.data?.code, rawCode, router, qc]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-medium">can&apos;t join this room</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/rooms">go to rooms</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-medium">joining room…</h1>
            <p className="text-sm text-muted-foreground">
              hold on while we open it up for you.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
