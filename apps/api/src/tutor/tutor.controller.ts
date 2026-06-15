import { Body, Controller, Param, Post, Req, Res, UsePipes } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  openTutorSessionSchema,
  tutorMessageSchema,
  type OpenTutorSessionInput,
  type TutorMessageInput,
} from '@kpm/types';
import { Throttle } from '@nestjs/throttler';
import { TutorService } from './tutor.service.js';
import { Roles } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('tutor')
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Roles('STUDENT', 'PARENT')
  @Post('sessions')
  @UsePipes(new ZodValidationPipe(openTutorSessionSchema))
  openSession(@Body() body: OpenTutorSessionInput) {
    return this.tutor.openSession(body);
  }

  // Streams the tutor reply over SSE. We write directly to the Fastify raw
  // response so tokens flush as they arrive (first-token latency matters).
  // Tighter limit: each tutor turn costs an LLM call. 20/min/IP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Roles('STUDENT', 'PARENT')
  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const parsed = tutorMessageSchema.parse(req.body) as TutorMessageInput;

    res.raw.setHeader('Content-Type', 'text/event-stream');
    res.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    res.raw.setHeader('Connection', 'keep-alive');
    res.raw.flushHeaders?.();

    const write = (event: string, data: unknown) =>
      res.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      for await (const ev of this.tutor.streamMessage(id, parsed.content, parsed.mode)) {
        write(ev.type, ev.data);
      }
    } catch (err) {
      write('error', { message: (err as Error).message });
    } finally {
      res.raw.end();
    }
  }
}
