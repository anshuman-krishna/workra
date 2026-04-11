'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileList } from '@/components/room/file-list';
import { filesApi } from '@/lib/api/files';
import { ApiError } from '@/lib/api/client';

export default function RoomFilesPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['files', roomId],
    queryFn: () => filesApi.listForRoom(roomId),
    enabled: Boolean(roomId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => filesApi.upload(roomId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', roomId] });
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
      toast.success('file uploaded');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'could not upload file');
    },
  });

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      // upload sequentially so versioning collisions don't race against each other
      for (const file of Array.from(fileList)) {
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const files = data?.files ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">files</h2>
          <p className="text-sm text-muted-foreground">
            shared artifacts. uploading the same name creates a new version.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'uploading…' : 'upload'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">loading files…</p>
      ) : error ? (
        <p className="text-sm text-destructive">could not load files.</p>
      ) : (
        <FileList files={files} roomId={roomId} />
      )}
    </div>
  );
}
