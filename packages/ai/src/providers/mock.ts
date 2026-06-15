import type {
  AiProviderClient,
  TutorRequest,
  TutorReplyResult,
  RiskClassification,
  PracticeSetRequest,
} from '@kpm/types';

// Deterministic, dependency-free provider so the platform runs and tests pass
// with NO API keys. It grounds answers strictly in retrieved chunks and mirrors
// the structured contract of the real providers. Not for production.
export class MockProvider implements AiProviderClient {
  generateTutorReply(req: TutorRequest) {
    const cited = req.retrieved.slice(0, 3);
    const grounded = cited.length > 0;
    const body = grounded
      ? `Here's help with **${req.mode}** based on your lesson:\n\n${cited
          .map((c) => `- ${c.content.slice(0, 160)}`)
          .join('\n')}`
      : `I'm not fully sure from the assigned lesson materials, so here's safe general guidance only. Try opening the related lesson first.`;

    const result: TutorReplyResult = {
      answer_markdown: `${body}\n\n**Takeaway:** Review the key idea above.\n**Next step:** Try one practice question.`,
      mastery_signal: grounded ? 'medium' : 'none',
      needs_parent_or_admin_review: false,
      citations: cited.map((c) => c.id),
    };

    // Stream word-by-word to exercise the SSE path end-to-end.
    const words = result.answer_markdown.split(' ');
    async function* gen() {
      for (const w of words) {
        yield w + ' ';
        await new Promise((r) => setTimeout(r, 2));
      }
    }
    return Object.assign(gen(), {
      final: async (): Promise<TutorReplyResult> => result,
    });
  }

  async classifyRisk(text: string): Promise<RiskClassification> {
    const lowered = text.toLowerCase();
    const danger = /(kill myself|suicide|hurt myself|abuse|self-harm)/.test(lowered);
    return {
      result: danger ? 'BLOCK' : 'PASS',
      categories: danger ? ['self_harm'] : [],
      scores: { self_harm: danger ? 0.95 : 0.0 },
      escalate: danger,
    };
  }

  async generatePracticeSet(req: PracticeSetRequest) {
    return {
      items: Array.from({ length: req.itemCount }, (_, i) => ({
        id: `q${i + 1}`,
        type: req.itemTypes[0] ?? 'mcq',
        prompt: `Practice question ${i + 1} for ${req.subjectVariantId}`,
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
        rubric: 'Award full marks for correct selection.',
        citations: req.retrieved.slice(0, 1).map((c) => c.id),
      })),
    };
  }

  async summarizeProgress(input: {
    studentName: string;
    records: Array<{ standard: string; mastery: number; tahap?: number | null }>;
  }): Promise<string> {
    const avg =
      input.records.reduce((s, r) => s + r.mastery, 0) /
      Math.max(1, input.records.length);
    return `${input.studentName} is averaging ${avg.toFixed(
      0,
    )}% mastery across ${input.records.length} standards. Focus next on the lowest-scoring strand.`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Cheap deterministic pseudo-embedding for local dev (NOT semantically real).
    return texts.map((t) => {
      const v = new Array(1536).fill(0);
      for (let i = 0; i < t.length; i++) v[i % 1536] += t.charCodeAt(i) % 17;
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    });
  }
}
