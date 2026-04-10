import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          auto-generated summaries, ready to share.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>coming soon</CardTitle>
          <CardDescription>
            work summaries, timelines, and exports. arriving in the next phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10" />
      </Card>
    </div>
  );
}
