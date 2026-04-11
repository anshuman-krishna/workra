'use client';

import { useParams } from 'next/navigation';
import { ChatView } from '@/components/room/chat-view';

export default function RoomChatPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">chat</h2>
        <p className="text-sm text-muted-foreground">
          the room's quiet backchannel. messages sync live when a socket is connected, fall back to polling otherwise.
        </p>
      </div>
      <ChatView roomId={params.id} />
    </div>
  );
}
