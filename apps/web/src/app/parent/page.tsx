'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { RoleGuard } from '@/components/RoleGuard';
import { ParentSummaryPanel } from '@/components/dashboard';
import { Card } from '@kpm/ui';
import { api } from '@/lib/api';

interface Dashboard {
  students: Array<{ id: string; fullName: string; level: string; masteryAvg: number; subjects: Array<{ subject: string }> }>;
  subscription: { planCode: string; status: string } | null;
  aiFlags: Array<{ messageId: string; studentId: string; createdAt: string }>;
}

export default function ParentDashboard() {
  return (
    <RoleGuard allow={['PARENT', 'ADMIN']}>
      <AppShell role="parent">
        <Inner />
      </AppShell>
    </RoleGuard>
  );
}

function Inner() {
  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => api.get<Dashboard>('/parents/dashboard'),
  });

  if (isLoading) return <p className="text-gray-500">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Family dashboard</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.students.map((s) => (
          <ParentSummaryPanel key={s.id} student={s} />
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Subscription</h2>
          {data.subscription ? (
            <p className="text-sm text-gray-600">
              {data.subscription.planCode} — <strong>{data.subscription.status}</strong>
            </p>
          ) : (
            <p className="text-sm text-gray-500">No active plan.</p>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">AI conversation flags</h2>
          {data.aiFlags.length === 0 ? (
            <p className="text-sm text-gray-500">No flagged conversations. 🎉</p>
          ) : (
            <ul className="text-sm text-amber-800">
              {data.aiFlags.map((f) => (
                <li key={f.messageId}>Flagged message for child {f.studentId.slice(0, 8)}</li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
