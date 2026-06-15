'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button, Card, MasteryBadge } from '@kpm/ui';
import { api } from '@/lib/api';

interface LessonBlock {
  id: string;
  blockType: string;
  payload: {
    markdown?: string;
    url?: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
  };
}
interface Activity {
  id: string;
  activityType: string;
  config: { items?: QuizItem[] };
}
interface QuizItem {
  id: string;
  prompt: string;
  options?: string[];
  answer?: string;
}
export interface Lesson {
  id: string;
  title: string;
  blocks: LessonBlock[];
  activities: Activity[];
  learningStandard: { title: string; learningStandardCode: string };
}

// MediaBlockRenderer — renders a single lesson block by type (text/video/etc.)
export function MediaBlockRenderer({ block }: { block: LessonBlock }) {
  switch (block.blockType) {
    case 'video':
      return (
        <figure>
          <video controls className="w-full rounded-lg" src={block.payload.url}>
            <track kind="captions" />
          </video>
          {block.payload.caption && <figcaption className="text-xs text-gray-500">{block.payload.caption}</figcaption>}
        </figure>
      );
    case 'image':
      // Media is served from object storage (MinIO/Azure Blob) on dynamic hosts
      // with unknown dimensions, so `unoptimized` skips the host allowlist + the
      // optimizer while keeping next/image's lazy-loading + a11y contract.
      return block.payload.url ? (
        <Image
          src={block.payload.url}
          alt={block.payload.alt ?? ''}
          width={block.payload.width ?? 1200}
          height={block.payload.height ?? 675}
          sizes="(max-width: 768px) 100vw, 768px"
          className="h-auto w-full rounded-lg"
          unoptimized
        />
      ) : null;
    case 'text':
    default:
      return <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{block.payload.markdown}</p>;
  }
}

// QuizCard — runs a single activity, submits, shows mastery band.
export function QuizCard({ activity }: { activity: Activity }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number | null; masteryBand: string } | null>(null);
  const items = activity.config.items ?? [];

  async function start() {
    const r = await api.post<{ attemptId: string }>(`/activities/${activity.id}/start`);
    setAttemptId(r.attemptId);
  }
  async function submit() {
    if (!attemptId) return;
    const r = await api.post<{ score: number | null; masteryBand: string }>(
      `/attempts/${attemptId}/submit`,
      { responses: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })) },
    );
    setResult(r);
  }

  return (
    <Card>
      <h3 className="mb-2 font-semibold">Practice ({activity.activityType})</h3>
      {!attemptId ? (
        <Button onClick={() => void start()}>Start</Button>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <fieldset key={item.id} className="space-y-1">
              <legend className="text-sm font-medium">{item.prompt}</legend>
              {(item.options ?? []).map((opt) => (
                <label key={opt} className="mr-3 inline-flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={item.id}
                    value={opt}
                    onChange={() => setAnswers((a) => ({ ...a, [item.id]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </fieldset>
          ))}
          <Button onClick={() => void submit()}>Submit</Button>
          {result && (
            <p className="text-sm">
              Score: {result.score ?? '—'} <MasteryBadge band={result.masteryBand as never} />
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function LessonRenderer({ lesson }: { lesson: Lesson }) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs uppercase text-brand">{lesson.learningStandard.learningStandardCode}</p>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        <p className="text-sm text-gray-500">{lesson.learningStandard.title}</p>
      </header>
      <Card className="space-y-4">
        {lesson.blocks.map((b) => (
          <MediaBlockRenderer key={b.id} block={b} />
        ))}
      </Card>
      {lesson.activities.map((a) => (
        <QuizCard key={a.id} activity={a} />
      ))}
    </div>
  );
}
