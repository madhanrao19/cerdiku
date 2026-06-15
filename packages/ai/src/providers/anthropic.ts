import type {
  AiProviderClient,
  TutorRequest,
  TutorReplyResult,
  RiskClassification,
  PracticeSetRequest,
} from '@kpm/types';
import {
  MALAYSIA_KPM_TUTOR_SYSTEM,
  RISK_CLASSIFIER_SYSTEM,
  buildTutorTurnPrompt,
  buildPracticeSetPrompt,
} from '../prompts.js';
import { extractJson } from '../json.js';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  embedModel?: string; // Anthropic has no native embeddings; see embed() note.
}

// Adapter for Claude via the Messages API. Uses fetch + SSE so it needs no SDK.
// Prompt caching is applied to the static system prompt to control cost
// (Anthropic documents prompt caching for exactly this).
export class AnthropicProvider implements AiProviderClient {
  private readonly model: string;
  constructor(private readonly cfg: AnthropicConfig) {
    this.model = cfg.model ?? 'claude-opus-4-8';
  }

  private headers() {
    return {
      'content-type': 'application/json',
      'x-api-key': this.cfg.apiKey,
      'anthropic-version': VERSION,
    };
  }

  generateTutorReply(req: TutorRequest) {
    const model = this.model;
    const headers = this.headers();
    const messages = [
      ...req.history.map((h) => ({
        role: h.role === 'student' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: buildTutorTurnPrompt(req) },
    ];

    let collected = '';
    async function* gen(): AsyncGenerator<string> {
      const res = await fetch(API, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          stream: true,
          system: [
            {
              type: 'text',
              text: MALAYSIA_KPM_TUTOR_SYSTEM,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'content_block_delta' && evt.delta?.text) {
              collected += evt.delta.text;
              yield evt.delta.text;
            }
          } catch {
            /* ignore keep-alive / non-JSON lines */
          }
        }
      }
    }

    return Object.assign(gen(), {
      final: async (): Promise<TutorReplyResult> => parseTutorReply(collected),
    });
  }

  async classifyRisk(text: string): Promise<RiskClassification> {
    const res = await fetch(API, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: 400,
        system: RISK_CLASSIFIER_SYSTEM,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic risk error ${res.status}`);
    const json = await res.json();
    const out = json.content?.[0]?.text ?? '{}';
    return extractJson<RiskClassification>(out);
  }

  async generatePracticeSet(req: PracticeSetRequest) {
    const res = await fetch(API, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildPracticeSetPrompt(req) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic practice error ${res.status}`);
    const json = await res.json();
    return extractJson(json.content?.[0]?.text ?? '{}');
  }

  async summarizeProgress(input: {
    studentName: string;
    records: Array<{ standard: string; mastery: number; tahap?: number | null }>;
  }): Promise<string> {
    const res = await fetch(API, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Write a short, encouraging parent-facing progress summary for ${
              input.studentName
            } based on: ${JSON.stringify(input.records)}. No KPM approval claims.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic summary error ${res.status}`);
    const json = await res.json();
    return json.content?.[0]?.text ?? '';
  }

  // Anthropic does not provide an embeddings endpoint. Production should use a
  // dedicated embedding model (OpenAI/Azure/Voyage). The factory wires an
  // embedding provider separately; this throws to make misuse loud.
  async embed(): Promise<number[][]> {
    throw new Error(
      'AnthropicProvider has no embeddings. Configure an embedding provider (OpenAI/Azure/Voyage).',
    );
  }
}

function parseTutorReply(text: string): TutorReplyResult {
  try {
    return extractJson<TutorReplyResult>(text);
  } catch {
    // Model streamed prose instead of JSON — wrap it safely.
    return {
      answer_markdown: text,
      mastery_signal: 'none',
      needs_parent_or_admin_review: false,
      citations: [],
    };
  }
}
