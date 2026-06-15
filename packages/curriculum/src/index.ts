import type { Level, SchoolType, Language, DlpMode } from '@kpm/types';

// Helpers for the curriculum engine + future import tooling. A SubjectVariant is
// uniquely identified by this tuple — the core KPM modeling decision.
export interface VariantKey {
  subjectCode: string;
  curriculumVersionCode: string;
  level: Level;
  schoolType: SchoolType;
  language: Language;
  dlpMode: DlpMode;
}

export function variantSlug(key: VariantKey): string {
  return [
    key.curriculumVersionCode,
    key.subjectCode,
    key.level,
    key.schoolType,
    key.language,
    key.dlpMode,
  ]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

// DLP applicability per the current guideline (Science/Math at primary + lower
// secondary; more upper-secondary STEM subjects). Used to validate variant
// creation and gate bilingual assessment.
const DLP_SUBJECTS: Record<Level, string[]> = {
  PRESCHOOL: [],
  PRIMARY: ['MATH', 'SCI'],
  LOWER_SECONDARY: ['MATH', 'SCI'],
  UPPER_SECONDARY: ['MATH', 'ADD-MATH', 'SCI', 'PHY', 'CHEM', 'BIO'],
};

export function isDlpEligible(level: Level, subjectCode: string): boolean {
  return DLP_SUBJECTS[level]?.includes(subjectCode) ?? false;
}
