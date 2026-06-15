'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface Me {
  id: string;
  role: 'PARENT' | 'STUDENT' | 'ADMIN' | 'CONTENT_ADMIN' | 'SAFETY_REVIEWER';
}

// Client-side gate: fetches /me and redirects to /login if the role is not
// allowed. The API enforces RBAC server-side regardless — this is UX only.
export function RoleGuard({
  allow,
  children,
}: {
  allow: Me['role'][];
  children: ReactNode;
}) {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me'),
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && (isError || (data && !allow.includes(data.role)))) {
      router.replace('/login');
    }
  }, [isLoading, isError, data, allow, router]);

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>;
  if (!data || !allow.includes(data.role)) return null;
  return <>{children}</>;
}
