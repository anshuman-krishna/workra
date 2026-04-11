'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import type { PublicMessage } from '@workra/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { messagesApi } from '@/lib/api/messages';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import { cn } from '@/lib/utils';
import { formatDateLabel, localDateKey } from '@/lib/format/time';

const PAGE_SIZE = 30;

interface Props {
  roomId: string;
}

interface MessagePage {
  messages: PublicMessage[];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ChatView({ roomId }: Props) {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  // react-query's infiniteQuery keeps pages in the order they were fetched.
  // page 0 is the newest; subsequent pages are older. cursor = oldest message's createdAt.
  const query = useInfiniteQuery({
    queryKey: ['messages', roomId],
    queryFn: ({ pageParam }) =>
      messagesApi.listForRoom(roomId, { before: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.messages.length < PAGE_SIZE) return undefined;
      const oldest = lastPage.messages[lastPage.messages.length - 1];
      return oldest?.createdAt;
    },
    enabled: Boolean(roomId),
    // lightweight polling as a fallback if the socket is offline
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // flatten pages and sort strictly by createdAt. server createdAt is the source of
  // truth for ordering, so optimistic messages (with a client-side timestamp) reconcile
  // cleanly once the server echo lands and the temp id is swapped out.
  const messages = useMemo<PublicMessage[]>(() => {
    if (!query.data) return [];
    const all: PublicMessage[] = [];
    for (const page of query.data.pages) {
      for (const m of page.messages) all.push(m);
    }
    all.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return all;
  }, [query.data]);

  // group consecutive messages by day for visual date separators
  const groups = useMemo(() => {
    const out: Array<{ key: string; date: Date; items: PublicMessage[] }> = [];
    for (const m of messages) {
      const created = new Date(m.createdAt);
      const key = localDateKey(created);
      const last = out[out.length - 1];
      if (last && last.key === key) {
        last.items.push(m);
      } else {
        out.push({ key, date: created, items: [m] });
      }
    }
    return out;
  }, [messages]);

  // scroll management:
  // - on initial load: jump to bottom
  // - on new incoming message: if already near the bottom, stick to bottom
  // - on loading older page: preserve the visible message by offsetting scrollTop
  const stickToBottomRef = useRef(true);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevMessageCountRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;

    // load older when the user scrolls near the top
    if (
      el.scrollTop < 100 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      prevScrollHeightRef.current = el.scrollHeight;
      void query.fetchNextPage();
    }
  }, [query]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const newCount = messages.length;
    const prevCount = prevMessageCountRef.current;

    if (prevCount === 0 && newCount > 0) {
      // initial paint: go straight to bottom
      el.scrollTop = el.scrollHeight;
    } else if (prevScrollHeightRef.current !== null) {
      // an older page was prepended: keep the viewport anchored on the previously visible line
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += delta;
      prevScrollHeightRef.current = null;
    } else if (newCount > prevCount && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    prevMessageCountRef.current = newCount;
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messagesApi.send(roomId, { content, attachmentFileIds: [] }),
    onMutate: async (content: string) => {
      await qc.cancelQueries({ queryKey: ['messages', roomId] });
      const previous = qc.getQueryData<InfiniteData<MessagePage>>(['messages', roomId]);

      // optimistic message with a temporary id so react can key it and the server
      // response can dedupe on arrival.
      const tempId = `temp-${Date.now()}`;
      const optimistic: PublicMessage = {
        id: tempId,
        roomId,
        content,
        sender: {
          id: currentUserId ?? 'me',
          displayName: useAuthStore.getState().user?.displayName ?? 'you',
          avatarSeed: useAuthStore.getState().user?.avatarSeed ?? '00000000',
        },
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      qc.setQueryData<InfiniteData<MessagePage>>(['messages', roomId], (old) => {
        if (!old) {
          return {
            pages: [{ messages: [optimistic] }],
            pageParams: [undefined],
          };
        }
        const [first, ...rest] = old.pages;
        return {
          ...old,
          pages: [
            { messages: [optimistic, ...(first?.messages ?? [])] },
            ...rest,
          ],
        };
      });
      stickToBottomRef.current = true;
      return { previous, tempId };
    },
    onError: (err, _content, ctx) => {
      if (ctx?.previous) qc.setQueryData(['messages', roomId], ctx.previous);
      toast.error(err instanceof ApiError ? err.message : 'could not send message');
    },
    onSuccess: ({ message }, _content, ctx) => {
      qc.setQueryData<InfiniteData<MessagePage>>(['messages', roomId], (old) => {
        if (!old) return old;
        const [first, ...rest] = old.pages;
        if (!first) return old;
        // drop the temp, then dedupe in case the socket beat us to it
        const withoutTemp = first.messages.filter((m) => m.id !== ctx?.tempId);
        if (withoutTemp.some((m) => m.id === message.id)) {
          return { ...old, pages: [{ messages: withoutTemp }, ...rest] };
        }
        return {
          ...old,
          pages: [{ messages: [message, ...withoutTemp] }, ...rest],
        };
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // enter sends, shift+enter newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col rounded-md border bg-card">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">loading messages…</p>
        ) : query.error ? (
          <p className="text-sm text-destructive">could not load messages.</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-sm">
              <h3 className="text-base font-medium">no messages yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                say something. this is a quiet place for real work, not noise.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {query.isFetchingNextPage && (
              <p className="text-center text-xs text-muted-foreground">loading older…</p>
            )}
            {groups.map((group) => (
              <section key={group.key}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatDateLabel(group.date)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <ul className="space-y-3">
                  {group.items.map((message) => {
                    const mine = currentUserId && message.sender.id === currentUserId;
                    return (
                      <li
                        key={message.id}
                        className={cn('flex items-start gap-3', mine && 'flex-row-reverse')}
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {initials(message.sender.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn('min-w-0 max-w-[75%]', mine && 'text-right')}>
                          <div
                            className={cn(
                              'flex items-baseline gap-2 text-xs text-muted-foreground',
                              mine && 'justify-end',
                            )}
                          >
                            <span className="font-medium text-foreground">
                              {mine ? 'you' : message.sender.displayName}
                            </span>
                            <span>{formatTime(message.createdAt)}</span>
                          </div>
                          <div
                            className={cn(
                              'mt-1 inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                              mine
                                ? 'bg-foreground text-background'
                                : 'bg-muted text-foreground',
                            )}
                          >
                            {message.content}
                          </div>
                          {message.attachments.length > 0 && (
                            <ul
                              className={cn(
                                'mt-1.5 space-y-1 text-xs text-muted-foreground',
                                mine && 'text-right',
                              )}
                            >
                              {message.attachments.map((a) => (
                                <li key={a.id} className="truncate">
                                  📎 {a.name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="write a message…"
            maxLength={4000}
            rows={1}
            className="min-h-[40px] resize-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || sendMutation.isPending}
            className="gap-1.5"
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? 'sending…' : 'send'}
          </Button>
        </div>
      </form>
    </div>
  );
}
