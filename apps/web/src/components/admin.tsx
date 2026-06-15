'use client';

import { Button, Card } from '@kpm/ui';

// AdminDataTable — generic typed table for admin lists.
export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  rows,
}: {
  columns: Array<{ key: keyof T; label: string }>;
  rows: T[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            {columns.map((c) => (
              <th key={String(c.key)} className="px-3 py-2 font-medium text-gray-600">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-3 py-2">
                  {String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ModerationReviewCard — a flagged tutor message for the Safety Reviewer queue.
export function ModerationReviewCard({
  item,
  onResolve,
}: {
  item: { id: string; content: string; createdAt: string };
  onResolve: (id: string) => void;
}) {
  return (
    <Card className="border-amber-200">
      <p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
      <p className="mt-1 text-sm">{item.content}</p>
      <div className="mt-2">
        <Button variant="ghost" onClick={() => onResolve(item.id)}>
          Mark reviewed
        </Button>
      </div>
    </Card>
  );
}

// BillingPlanCard — a selectable subscription plan.
export function BillingPlanCard({
  plan,
  onSelect,
}: {
  plan: { code: string; name: string; price: string; features: string[] };
  onSelect: (code: string) => void;
}) {
  return (
    <Card>
      <h3 className="font-semibold">{plan.name}</h3>
      <p className="text-2xl font-bold text-brand">{plan.price}</p>
      <ul className="mt-2 space-y-1 text-sm text-gray-600">
        {plan.features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>
      <Button className="mt-3 w-full" onClick={() => onSelect(plan.code)}>
        Choose plan
      </Button>
    </Card>
  );
}
