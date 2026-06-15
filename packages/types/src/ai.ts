import type {
  Language,
  DlpMode,
  SchoolType,
  Level,
  MasteryBand,
  MasterySignal,
  TutorMode,
} from './enums.js';

// The retrieval filter — every tutor/RAG call is scoped by these dimensions so
// a child only ever gets curriculum facts from their assigned variant.
export interface RetrievalFilter {
  curriculumVersionCode?: string;
  schoolType?: SchoolType;
  language?: Language;
  dlpMode?: DlpMode;
  subjectVariantId?: string;
  lessonId?: string;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  lessonId?: string;
  subjectVariantId?: string;
  score: number;
}

export interface StudentContext {
  ageBand: string;
  level: Level;
  schoolType: SchoolType;
  languagePref: Language;
  dlpMode: DlpMode;
  subjectVariant?: string;
  recentMastery?: MasteryBand;
  responseLength: 'short' | 'medium' | 'long';
}

export interface TutorRequest {
  student: StudentContext;
  mode: TutorMode;
  question: string;
  history: Array<{ role: 'student' | 'assistant'; content: string }>;
  retrieved: RetrievedChunk[];
}

export interface TutorReplyResult {
  answer_markdown: string;
  mastery_signal: MasterySignal;
  needs_parent_or_admin_review: boolean;
  citations: string[]; // chunk ids
}

export interface RiskClassification {
  result: 'PASS' | 'FLAG' | 'BLOCK';
  categories: string[];
  scores: Record<string, number>;
  escalate: boolean;
}

export interface PracticeSetRequest {
  curriculumVersionCode: string;
  subjectVariantId: string;
  level: Level;
  language: Language;
  dlpMode: DlpMode;
  learningStandardCodes: string[];
  difficulty: number;
  itemCount: number;
  itemTypes: string[];
  retrieved: RetrievedChunk[];
}

// The single interface every provider adapter implements.
export interface AiProviderClient {
  generateTutorReply(req: TutorRequest): AsyncIterable<string> & {
    final: () => Promise<TutorReplyResult>;
  };
  classifyRisk(text: string): Promise<RiskClassification>;
  generatePracticeSet(req: PracticeSetRequest): Promise<unknown>;
  summarizeProgress(input: {
    studentName: string;
    records: Array<{ standard: string; mastery: number; tahap?: number | null }>;
  }): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}
