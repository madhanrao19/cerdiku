import { Global, Module } from '@nestjs/common';
import { createAiProvider } from '@kpm/ai';
import type { AiProviderClient } from '@kpm/types';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (): AiProviderClient => createAiProvider(process.env),
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
