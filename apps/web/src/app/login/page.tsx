'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Field, Input } from '@kpm/ui';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('parent@demo.my');
  const [password, setPassword] = useState('parent1234');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.post<{ role: string }>('/auth/login', { identifier, password });
      const dest = r.role === 'ADMIN' || r.role === 'CONTENT_ADMIN' || r.role === 'SAFETY_REVIEWER'
        ? '/admin'
        : r.role === 'STUDENT'
          ? '/student'
          : '/parent';
      router.push(dest);
    } catch (err) {
      setError(err instanceof ApiError ? 'Invalid credentials' : 'Login failed');
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <Card>
        <h1 className="mb-4 text-xl font-bold">Sign in</h1>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Email or phone">
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-3 text-xs text-gray-500">Demo: parent@demo.my / parent1234</p>
      </Card>
    </main>
  );
}
