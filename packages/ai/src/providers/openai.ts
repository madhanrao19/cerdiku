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

export interface OpenAiConfig {
  apiKey: string;
  model?: string;
  embedModel?: string;
  // Azure: set baseUrl to the deployment endpoint and apiVersion.
  baseUrl?: string;
  apiVersion?: string;
  isAzure?: boolean;
}

// OpenAI-compatible adapter. Serves both OpenAI direct and Azure OpenAI by
// switching the URL/auth header. Uses the Chat Completions shape for broad
// compatibility and streams via SSE.
export class OpenAiProvider implements AiProviderClient {
  private readonly model: string;
  private readonly embedModel: string;
  constructor(private readonly cfg: OpenAiConfig) {
    this.model = cfg.model ?? 'gpt-4o';
    this.embedModel = cfg.embedModel ?? 'text-embedding-3-small';
  }

  private chatUrl() {
    if (this.cfg.isAzure) {
      return `${this.cfg.baseUrl}/openai/deployments/${this.model}/chat/completions?api-version=${
        this.cfg.apiVersion ?? '2024-06-01'
      }`;
    }
    return `${this.cfg.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
  }

  private embedUrl() {
    if (this.cfg.isAzure) {
      return `${this.cfg.baseUrl}/openai/deployments/${this.embedModel}/embeddings?api-version=${
        this.cfg.apiVersion ?? '2024-06-01'
      }`;
    }
    return `${this.cfg.baseUrl ?? 'https://api.openai.com/v1'}/embeddings`;
  }

  private headers(): Record<string, string> {
    return this.cfg.isAzure
      ? { 'content-type': 'application/json', 'api-key': this.cfg.apiKey }
      : {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.apiKey}`,
        };
  }

  generateTutorReply(req: TutorRequest) {
    const url = this.chatUrl();
    const headers = this.headers();
    const model = this.model;
    const messages = [
      { role: 'system', content: MALAYSIA_KPM_TUTOR_SYSTEM },
      ...req.history.map((h) => ({
        role: h.role === 'student' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: buildTutorTurnPrompt(req) },
    ];

    let collected = '';
    async function* gen(): AsyncGenerator<string> {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          stream: true,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
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
            const delta = evt.choices?.[0]?.delta?.content;
            if (delta) {
              collected += delta;
              yield delta;
            }
          } catch {
            /* ignore */
          }
        }
      }
    }

    return Object.assign(gen(), {
      final: async (): Promise<TutorReplyResult> => {
        try {
          return extractJson<TutorReplyResult>(collected);
        } catch {
          return {
            answer_markdown: collected,
            mastery_signal: 'none',
            needs_parent_or_admin_review: false,
            citations: [],
          };
        }
      },
    });
  }

  async classifyRisk(text: string): Promise<RiskClassification> {
    const res = await fetch(this.chatUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: RISK_CLASSIFIER_SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI risk error ${res.status}`);
    const json = await res.json();
    return extractJson<RiskClassification>(json.choices?.[0]?.message?.content ?? '{}');
  }

  async generatePracticeSet(req: PracticeSetRequest) {
    const res = await fetch(this.chatUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildPracticeSetPrompt(req) }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI practice error ${res.status}`);
    const json = await res.json();
    return extractJson(json.choices?.[0]?.message?.content ?? '{}');
  }

  async summarizeProgress(input: {
    studentName: string;
    records: Array<{ standard: string; mastery: number; tahap?: number | null }>;
  }): Promise<string> {
    const res = await fetch(this.chatUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: `Write a short parent-facing progress summary for ${
              input.studentName
            }: ${JSON.stringify(input.records)}. No KPM approval claims.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI summary error ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(this.embedUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.embedModel, input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI embed error ${res.status}`);
    const json = await res.json();
    return json.data.map((d: { embedding: number[] }) => d.embedding);
  }
}
