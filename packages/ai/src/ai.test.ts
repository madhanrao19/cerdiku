import { describe, it, expect } from 'vitest';
import { MockProvider } from './providers/mock.js';
import { extractJson } from './json.js';
import { moderateInput } from './moderation.js';
import type { TutorRequest } from '@kpm/types';

const baseReq: TutorRequest = {
  student: {
    ageBand: '7-9',
    level: 'PRIMARY',
    schoolType: 'SK',
    languagePref: 'BM',
    dlpMode: 'NONE',
    responseLength: 'short',
  },
  mode: 'explain',
  question: 'What is 2 + 3?',
  history: [],
  retrieved: [
    { id: 'chunk_a', content: 'Addition combines two numbers. 2 + 3 = 5.', score: 0.9 },
  ],
};

describe('extractJson', () => {
  it('parses fenced json', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('parses json embedded in prose', () => {
    expect(extractJson('Here you go: {"b":2} done')).toEqual({ b: 2 });
  });
});

describe('MockProvider tutor reply', () => {
  it('streams and returns a grounded structured reply with citations', async () => {
    const ai = new MockProvider();
    const stream = ai.generateTutorReply(baseReq);
    let streamed = '';
    for await (const tok of stream) streamed += tok;
    const final = await stream.final();
    expect(streamed.length).toBeGreaterThan(0);
    expect(final.citations).toContain('chunk_a');
    expect(['none', 'low', 'medium', 'high']).toContain(final.mastery_signal);
  });
});

describe('moderation', () => {
  it('blocks and escalates self-harm input', async () => {
    const ai = new MockProvider();
    const decision = await moderateInput(ai, 'i want to hurt myself');
    expect(decision.allowed).toBe(false);
    expect(decision.escalate).toBe(true);
    expect(decision.studentSafeMessage).toBeTruthy();
  });
  it('passes ordinary study questions', async () => {
    const ai = new MockProvider();
    const decision = await moderateInput(ai, 'help me with fractions');
    expect(decision.allowed).toBe(true);
  });
});
