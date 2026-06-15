import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-4xl font-bold text-brand">KPM Learning Platform</h1>
      <p className="mt-4 text-lg text-gray-600">
        A KPM-aligned digital learning platform for Malaysian preschool, primary, and
        secondary home learners.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        A subscription learning platform — not a registered school.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/login" className="rounded-lg bg-brand px-5 py-2.5 text-brand-fg">
          Sign in
        </Link>
        <Link href="/register" className="rounded-lg border border-brand px-5 py-2.5 text-brand">
          Create parent account
        </Link>
      </div>
    </main>
  );
}
