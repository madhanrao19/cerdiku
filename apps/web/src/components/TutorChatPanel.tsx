'use client';

import { useState } from 'react';
import { Button, Card, CitationPill, Input } from '@kpm/ui';
import { api, streamTutorMessage } from '@/lib/api';

interface Msg {
  role: 'student' | 'assistant';
  content: string;
  citations?: Array<{ id: string; locator?: string | null }>;
  blocked?: boolean;
}

// Connected tutor chat with live SSE streaming + citation rendering. Opens a
// session against the given student/lesson on first send.
export function TutorChatPanel({ studentId, lessonId }: { studentId: string; lessonId?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    const s = await api.post<{ id: string }>('/tutor/sessions', { studentId, lessonId });
    setSessionId(s.id);
    return s.id;
  }

  async function send() {
    if (!input.trim() || streaming) return;
    const question = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'student', content: question }]);
    setStreaming(true);

    const id = await ensureSession();
    let assistant: Msg = { role: 'assistant', content: '' };
    setMessages((m) => [...m, assistant]);

    await streamTutorMessage(id, question, {
      onToken: (t) => {
        assistant = { ...assistant, content: assistant.content + t };
        setMessages((m) => [...m.slice(0, -1), assistant]);
      },
      onBlocked: (msg) => {
        assistant = { role: 'assistant', content: msg, blocked: true };
        setMessages((m) => [...m.slice(0, -1), assistant]);
      },
      onFinal: (r) => {
        const reply = r as { answer_markdown: string; citations: string[] };
        assistant = {
          role: 'assistant',
          content: reply.answer_markdown,
          citations: reply.citations.map((c) => ({ id: c })),
        };
        setMessages((m) => [...m.slice(0, -1), assistant]);
      },
      onError: (msg) => {
        assistant = { role: 'assistant', content: `⚠️ ${msg}` };
        setMessages((m) => [...m.slice(0, -1), assistant]);
      },
    });
    setStreaming(false);
  }

  return (
    <Card className="flex h-[28rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Ask about your lesson. The tutor only uses your assigned curriculum materials.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'student' ? 'text-right' : 'text-left'}
          >
            <div
              className={
                m.role === 'student'
                  ? 'inline-block rounded-lg bg-brand px-3 py-2 text-sm text-brand-fg'
                  : `inline-block rounded-lg px-3 py-2 text-sm ${m.blocked ? 'bg-red-50 text-red-800' : 'bg-gray-100'}`
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.citations && m.citations.length > 0 && (
                <p className="mt-2">
                  {m.citations.map((c) => (
                    <CitationPill key={c.id} id={c.id} locator={c.locator} />
                  ))}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          aria-label="Ask the tutor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          disabled={streaming}
        />
        <Button type="submit" disabled={streaming}>
          {streaming ? '…' : 'Send'}
        </Button>
      </form>
    </Card>
  );
}
