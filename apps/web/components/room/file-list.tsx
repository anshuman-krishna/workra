'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Download,
  File as FileIcon,
  Trash2,
} from 'lucide-react';
import type { PublicFile } from '@workra/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { filesApi } from '@/lib/api/files';
import { ApiError } from '@/lib/api/client';
import { formatBytes } from '@/lib/format/bytes';
import { formatDateLabel } from '@/lib/format/time';

interface Props {
  files: PublicFile[];
  roomId: string;
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

export function FileList({ files, roomId }: Props) {
  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <h2 className="text-base font-medium">no files yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            drop something the room needs to share. uploads create a new version automatically when the name matches.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {files.map((file) => (
          <FileRow key={file.id} file={file} roomId={roomId} />
        ))}
      </CardContent>
    </Card>
  );
}

function FileRow({ file, roomId }: { file: PublicFile; roomId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const versionsQuery = useQuery({
    queryKey: ['file', file.id, 'versions'],
    queryFn: () => filesApi.versions(file.id),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: () => filesApi.remove(file.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', roomId] });
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
      toast.success('file deleted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'could not delete file');
    },
  });

  async function handleDownload(targetId: string) {
    try {
      setDownloading(true);
      const { file: signed } = await filesApi.get(targetId);
      window.open(signed.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'could not generate download link');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
          <FileIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{formatBytes(file.size)}</span>
            <span>v{file.version}</span>
            <span className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {initials(file.uploadedBy.displayName)}
                </AvatarFallback>
              </Avatar>
              {file.uploadedBy.displayName}
            </span>
            <span>{formatDateLabel(new Date(file.createdAt))}</span>
            {file.version > 1 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 hover:text-foreground"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                history
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleDownload(file.id)}
          disabled={downloading}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="download file"
        >
          <Download className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (confirm(`delete "${file.name}" and all its versions?`)) deleteMutation.mutate();
          }}
          disabled={deleteMutation.isPending}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="delete file"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="ml-12 mt-3 rounded-md border bg-muted/30 px-3 py-2">
          {versionsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">loading…</p>
          ) : versionsQuery.data?.versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">no version history.</p>
          ) : (
            <ul className="space-y-1.5">
              {versionsQuery.data?.versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-mono text-foreground">v{v.version}</span>
                    <span>· {v.uploadedBy.displayName}</span>
                    <span>· {formatBytes(v.size)}</span>
                    <span>· {formatDateLabel(new Date(v.createdAt))}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownload(v.id)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`download version ${v.version}`}
                  >
                    <Download className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
