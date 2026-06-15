'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { RoleGuard } from '@/components/RoleGuard';
import { TutorChatPanel } from '@/components/TutorChatPanel';
import { ProgressHeatmap } from '@/components/dashboard';
import { Card } from '@kpm/ui';
import { api } from '@/lib/api';

interface Me {
  id: string;
  studentProfile?: { id: string; fullName: string; level: string } | null;
}
interface ProgressRecord {
  masteryScore: string;
  learningStandard: { title: string };
}

export default function StudentToday() {
  return (
    <RoleGuard allow={['STUDENT']}>
      <AppShell role="student">
        <Inner />
      </AppShell>
    </RoleGuard>
  );
}

function Inner() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/auth/me') });
  const studentId = me?.studentProfile?.id;

  const { data: progress } = useQuery({
    queryKey: ['progress', studentId],
    queryFn: () => api.get<ProgressRecord[]>(`/students/${studentId}/progress`),
    enabled: !!studentId,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Hi {me?.studentProfile?.fullName ?? 'there'} 👋
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 font-semibold">Your progress</h2>
            <ProgressHeatmap
              records={(progress ?? []).map((p) => ({
                title: p.learningStandard.title,
                masteryScore: Number(p.masteryScore),
              }))}
            />
          </Card>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Ask your tutor</h2>
          {studentId && <TutorChatPanel studentId={studentId} />}
        </div>
      </div>
    </div>
  );
}
