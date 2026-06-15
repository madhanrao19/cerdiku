// Thin fetch client. Calls go to the same origin (/api/*) and Next rewrites
// them to the API, so httpOnly auth cookies are sent automatically.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, `Request failed: ${res.status}`, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};

// Opens an SSE stream for a tutor message turn. Calls onToken as tokens arrive
// and onFinal when the structured reply lands.
export async function streamTutorMessage(
  sessionId: string,
  content: string,
  handlers: {
    onToken: (t: string) => void;
    onFinal: (r: unknown) => void;
    onBlocked?: (msg: string) => void;
    onError?: (msg: string) => void;
  },
): Promise<void> {
  const res = await fetch(`/api/tutor/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });
  if (!res.body) {
    handlers.onError?.('No response stream');
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const evMatch = frame.match(/^event: (.+)$/m);
      const dataMatch = frame.match(/^data: (.+)$/m);
      if (!dataMatch?.[1]) continue;
      const event = evMatch?.[1] ?? 'message';
      const data = JSON.parse(dataMatch[1]);
      if (event === 'token') handlers.onToken(data);
      else if (event === 'final') handlers.onFinal(data);
      else if (event === 'blocked') handlers.onBlocked?.(data);
      else if (event === 'error') handlers.onError?.(data?.message ?? 'error');
    }
  }
}
