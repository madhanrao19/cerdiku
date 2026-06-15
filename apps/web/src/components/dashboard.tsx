'use client';

import { useState } from 'react';
import { Card, MasteryBadge } from '@kpm/ui';

// StudentSwitcher — picks the active child in multi-child households.
export function StudentSwitcher({
  students,
  value,
  onChange,
}: {
  students: Array<{ id: string; fullName: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-gray-600">Child:</span>
      <select
        className="rounded-lg border border-gray-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

// CurriculumFilterBar — level/school-type/language/DLP filters for content.
export function CurriculumFilterBar({
  onChange,
}: {
  onChange: (f: Record<string, string>) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => {
    const next = { ...f, [k]: v };
    setF(next);
    onChange(next);
  };
  const selects: Array<[string, string[]]> = [
    ['level', ['PRESCHOOL', 'PRIMARY', 'LOWER_SECONDARY', 'UPPER_SECONDARY']],
    ['schoolType', ['SK', 'SJKC', 'SJKT', 'SMK']],
    ['language', ['BM', 'EN', 'ZH', 'TA']],
    ['dlpMode', ['NONE', 'BILINGUAL', 'DLP_SUBJECT_VARIANT']],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {selects.map(([key, opts]) => (
        <select
          key={key}
          aria-label={key}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          onChange={(e) => set(key, e.target.value)}
        >
          <option value="">{key}</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

// ProgressHeatmap — simple mastery grid per standard.
export function ProgressHeatmap({
  records,
}: {
  records: Array<{ title: string; masteryScore: number }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {records.map((r, i) => {
        const band = r.masteryScore >= 80 ? 'HIGH' : r.masteryScore >= 50 ? 'MEDIUM' : r.masteryScore > 0 ? 'LOW' : 'NONE';
        return (
          <div key={i} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1 text-sm">
            <span className="truncate">{r.title}</span>
            <MasteryBadge band={band as never} />
          </div>
        );
      })}
    </div>
  );
}

// ParentSummaryPanel — per-child overview card.
export function ParentSummaryPanel({
  student,
}: {
  student: { fullName: string; level: string; masteryAvg: number; subjects: Array<{ subject: string }> };
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{student.fullName}</h3>
        <span className="text-xs text-gray-500">{student.level}</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">Avg mastery: {student.masteryAvg}%</p>
      <ul className="mt-2 text-sm text-gray-700">
        {student.subjects.map((s, i) => (
          <li key={i}>• {s.subject}</li>
        ))}
      </ul>
    </Card>
  );
}
