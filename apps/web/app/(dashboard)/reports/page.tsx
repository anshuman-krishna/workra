'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, FileText, Loader2, Sparkles } from 'lucide-react';
import type { ReportResponse } from '@workra/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReportView } from '@/components/report/report-view';
import { roomsApi } from '@/lib/api/rooms';
import { reportsApi, browserTz, type ReportFilters } from '@/lib/api/reports';
import { ApiError } from '@/lib/api/client';
import { localDateKey } from '@/lib/format/time';

// default range: the trailing 30 days including today
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 29);
  return { from: localDateKey(from), to: localDateKey(today) };
}

export default function ReportsPage() {
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: roomsApi.list,
  });

  const [roomId, setRoomId] = useState<string>('');
  const [{ from, to }, setRange] = useState(defaultRange);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [downloading, setDownloading] = useState(false);
  // tracks whether the current narrative came from the ai layer. resets whenever
  // the user regenerates the base report.
  const [aiEnhanced, setAiEnhanced] = useState(false);

  // auto-select the first room once the list loads
  const availableRooms = rooms.data?.rooms ?? [];
  useEffect(() => {
    if (!roomId && availableRooms.length > 0) {
      setRoomId(availableRooms[0].id);
    }
  }, [roomId, availableRooms]);

  const tz = useMemo(() => browserTz(), []);

  const generate = useMutation({
    mutationFn: async (filters: { roomId: string } & ReportFilters) => {
      const res = await reportsApi.getRoomReport(filters.roomId, {
        from: filters.from,
        to: filters.to,
        tz: filters.tz,
      });
      return res.report;
    },
    onSuccess: (r) => {
      setReport(r);
      setAiEnhanced(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'could not generate report');
    },
  });

  // second mutation for the ai narrative. runs on top of an already-rendered
  // report — never blocks the user from interacting with the rest of the view.
  const enhance = useMutation({
    mutationFn: async () => {
      if (!report) throw new Error('no report to enhance');
      return reportsApi.enhanceNarrative(report.room.id, {
        from,
        to,
        tz,
      });
    },
    onSuccess: (res) => {
      if (!report) return;
      if (!res.aiGenerated) {
        // the server tried the llm and fell back. let the user know rather than
        // silently pretending — workra's whole voice is "we don't lie to you".
        toast.message('ai layer unavailable — keeping the system summary');
        return;
      }
      setReport({ ...report, summary: { ...report.summary, narrative: res.narrative } });
      setAiEnhanced(true);
      toast.success('narrative enhanced');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'could not enhance narrative');
    },
  });

  const canGenerate = roomId && from && to && from <= to;

  const onGenerate = () => {
    if (!canGenerate) {
      toast.error('pick a room and a valid range');
      return;
    }
    generate.mutate({ roomId, from, to, tz });
  };

  const onCopySummary = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.summary.narrative);
      toast.success('summary copied');
    } catch {
      toast.error('clipboard unavailable');
    }
  };

  const onDownloadPdf = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const blob = await reportsApi.downloadRoomReportPdf(report.room.id, { from, to, tz });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFilename(report);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'could not download pdf');
    } finally {
      setDownloading(false);
    }
  };

  const headerSubtitle = useMemo(() => {
    if (!report) return 'pick a room and range, then generate.';
    return `${report.room.name} · ${report.range.from.slice(0, 10)} to ${report.range.to.slice(0, 10)}`;
  }, [report]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">{headerSubtitle}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="report-room">room</Label>
              <select
                id="report-room"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={rooms.isLoading || availableRooms.length === 0}
              >
                {availableRooms.length === 0 ? (
                  <option value="">no rooms yet</option>
                ) : (
                  availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-from">from</Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-to">to</Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>

            <Button onClick={onGenerate} disabled={!canGenerate || generate.isPending}>
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> generating
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" /> generate
                </>
              )}
            </Button>
          </div>

          {report && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => enhance.mutate()}
                disabled={enhance.isPending}
              >
                {enhance.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> thinking
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> enhance with ai
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onCopySummary}>
                <Copy className="mr-2 h-4 w-4" /> copy summary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadPdf}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> preparing
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" /> download pdf
                  </>
                )}
              </Button>
              {aiEnhanced && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> ai-enhanced narrative
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {generate.isPending && !report && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> compiling the work log…
          </CardContent>
        </Card>
      )}

      {!generate.isPending && !report && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            nothing generated yet. reports are built on demand from your sessions, tasks, and
            events — so what you see always matches the current state of the room.
          </CardContent>
        </Card>
      )}

      {report && <ReportView report={report} />}
    </div>
  );
}

function buildFilename(report: ReportResponse): string {
  const slug = report.room.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `workra-${slug || 'report'}-${report.range.from.slice(0, 10)}-to-${report.range.to.slice(0, 10)}.pdf`;
}
