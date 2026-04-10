import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          your time across every room, in one view.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>coming soon</CardTitle>
          <CardDescription>monthly and weekly views with a github-style heatmap.</CardDescription>
        </CardHeader>
        <CardContent className="pb-10" />
      </Card>
    </div>
  );
}
