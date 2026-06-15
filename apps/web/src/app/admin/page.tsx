'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { RoleGuard } from '@/components/RoleGuard';
import { AdminDataTable } from '@/components/admin';
import { Card } from '@kpm/ui';
import { api } from '@/lib/api';

interface Cohorts {
  totals: {
    students: number;
    submittedAttempts: number;
    tutorSessions: number;
    openInterventions: number;
    avgMasteryScore: string;
  };
  studentsByLevel: Array<{ level: string; count: number }>;
}

export default function AdminOverview() {
  return (
    <RoleGuard allow={['ADMIN', 'CONTENT_ADMIN', 'SAFETY_REVIEWER']}>
      <AppShell role="admin">
        <Inner />
      </AppShell>
    </RoleGuard>
  );
}

function Inner() {
  const { data } = useQuery({ queryKey: ['cohorts'], queryFn: () => api.get<Cohorts>('/analytics/cohorts') });
  if (!data) return <p className="text-gray-500">Loading…</p>;

  const t = data.totals;
  const cards = [
    ['Students', t.students],
    ['Submitted attempts', t.submittedAttempts],
    ['Tutor sessions', t.tutorSessions],
    ['Open interventions', t.openInterventions],
    ['Avg mastery', `${t.avgMasteryScore}%`],
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Operations overview</h1>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <p className="text-2xl font-bold text-brand">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="mb-2 font-semibold">Students by level</h2>
        <AdminDataTable
          columns={[
            { key: 'level', label: 'Level' },
            { key: 'count', label: 'Students' },
          ]}
          rows={data.studentsByLevel}
        />
      </Card>
    </div>
  );
}
