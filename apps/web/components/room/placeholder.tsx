import { Card, CardContent } from '@/components/ui/card';

export function TabPlaceholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Card>
      <CardContent className="py-14 text-center">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{blurb}</p>
      </CardContent>
    </Card>
  );
}
