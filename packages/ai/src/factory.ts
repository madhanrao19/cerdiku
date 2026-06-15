import type { AiProviderClient } from '@kpm/types';
import { MockProvider } from './providers/mock.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAiProvider } from './providers/openai.js';

export interface AiFactoryEnv {
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
}

// Selects the chat provider from env, falling back to MockProvider when no key
// is configured so the platform runs locally with zero credentials.
//
// Embeddings are resolved independently: Anthropic has no embeddings endpoint,
// so when Claude is the chat provider we still route embed() to OpenAI/Azure if
// available, else the mock embedder. The returned client composes the two.
export function createAiProvider(env: AiFactoryEnv): AiProviderClient {
  const chat = pickChatProvider(env);
  const embedder = pickEmbedProvider(env);
  if (!embedder || embedder === chat) return chat;

  // Compose: delegate everything to chat, but embed() to the embedder.
  return new Proxy(chat, {
    get(target, prop, receiver) {
      if (prop === 'embed') return embedder.embed.bind(embedder);
      return Reflect.get(target, prop, receiver);
    },
  });
}

function pickChatProvider(env: AiFactoryEnv): AiProviderClient {
  const provider = env.AI_PROVIDER ?? 'anthropic';
  if (provider === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }
  if (provider === 'azure-openai' && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT) {
    return new OpenAiProvider({
      apiKey: env.AZURE_OPENAI_API_KEY,
      baseUrl: env.AZURE_OPENAI_ENDPOINT,
      model: env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o',
      isAzure: true,
    });
  }
  if (provider === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAiProvider({ apiKey: env.OPENAI_API_KEY });
  }
  // No credentials for the requested provider — safe local fallback.
  return new MockProvider();
}

function pickEmbedProvider(env: AiFactoryEnv): AiProviderClient | null {
  if (env.OPENAI_API_KEY) return new OpenAiProvider({ apiKey: env.OPENAI_API_KEY });
  if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT) {
    return new OpenAiProvider({
      apiKey: env.AZURE_OPENAI_API_KEY,
      baseUrl: env.AZURE_OPENAI_ENDPOINT,
      isAzure: true,
    });
  }
  return new MockProvider();
}
