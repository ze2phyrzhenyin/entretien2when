import { Card } from "@/components/ui/card";

export function TimeRangePreview({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无时间。</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <Card key={item} className="px-3 py-2 text-sm" variant="subtle">
          {item}
        </Card>
      ))}
    </div>
  );
}
