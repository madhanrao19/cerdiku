'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function AppShell({
  role,
  children,
}: {
  role: 'parent' | 'student' | 'admin';
  children: ReactNode;
}) {
  const nav: Record<'parent' | 'student' | 'admin', Array<{ href: string; label: string }>> = {
    parent: [
      { href: '/parent', label: 'Dashboard' },
      { href: '/parent/reports', label: 'Reports' },
      { href: '/parent/billing', label: 'Billing' },
    ],
    student: [
      { href: '/student', label: 'Today' },
      { href: '/student/practice', label: 'Practice' },
      { href: '/student/tutor', label: 'Ask Tutor' },
    ],
    admin: [
      { href: '/admin', label: 'Overview' },
      { href: '/admin/content', label: 'Content' },
      { href: '/admin/moderation', label: 'Moderation' },
    ],
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-bold text-brand">
            Cerdiku
          </Link>
          <nav aria-label="Primary" className="flex gap-1">
            {nav[role].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-brand-muted hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
