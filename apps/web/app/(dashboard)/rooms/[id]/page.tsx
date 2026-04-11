'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Check, Copy, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { roomsApi } from '@/lib/api/rooms';
import { ActivityTimeline } from '@/components/room/activity-timeline';

export default function RoomOverviewPage() {
  const params = useParams<{ id: string }>();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const { data } = useQuery({
    queryKey: ['room', params.id],
    queryFn: () => roomsApi.get(params.id),
    enabled: Boolean(params.id),
  });

  const room = data?.room;
  const isOwner = room?.role === 'owner';

  const { data: inviteData } = useQuery({
    queryKey: ['room', params.id, 'invite'],
    queryFn: () => roomsApi.getInvite(params.id),
    enabled: Boolean(params.id) && isOwner,
  });

  if (!room) return null;

  const copy = async (kind: 'code' | 'link', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success('copied');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('could not copy');
    }
  };

  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>invite</CardTitle>
          <CardDescription>share the code or the link to bring someone in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-md bg-secondary px-4 py-3">
            <span className="font-mono text-lg uppercase tracking-[0.3em]">{room.inviteCode}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => copy('code', room.inviteCode)}
              aria-label="copy code"
            >
              {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {isOwner && inviteData?.invite.link && (
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{inviteData.invite.link}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => copy('link', inviteData.invite.link)}
                aria-label="copy link"
              >
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            invited members join as collaborators by default.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>this room</CardTitle>
          <CardDescription>a quiet place to do real work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>created</span>
            <span>{new Date(room.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>members</span>
            <span>{room.memberCount}</span>
          </div>
          <div className="flex justify-between">
            <span>your role</span>
            <span>{room.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>

      <ActivityTimeline roomId={params.id} />
    </div>
  );
}
