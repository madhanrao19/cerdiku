import './tracing.js'; // must be first — starts OpenTelemetry before other imports
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { loadEnv } from '@kpm/config';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  await app.register(fastifyCookie as never);

  // Security headers at the application layer so they apply on every host
  // (dev, Azure App Service) — not only behind the Caddy reverse proxy.
  // CSP is left to the edge/proxy since the API serves JSON, not HTML.
  await app.register(fastifyHelmet as never, { contentSecurityPolicy: false });

  // Capture the raw request body so payment webhooks can verify HMAC signatures
  // while normal routes still receive parsed JSON.
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string, done) => {
      (req as { rawBody?: string }).rawBody = body;
      try {
        done(null, body ? JSON.parse(body) : {});
      } catch (err) {
        done(err as Error);
      }
    },
  );
  // Billplz (and most Malaysian gateways) post form-urlencoded webhooks; capture
  // the raw body here too so HMAC signature verification works.
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body: string, done) => {
      (req as { rawBody?: string }).rawBody = body;
      const parsed: Record<string, string> = {};
      for (const pair of body.split('&')) {
        const [k, v] = pair.split('=');
        if (k) parsed[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      }
      done(null, parsed);
    },
  );

  app.enableCors({
    origin: env.NEXT_PUBLIC_APP_URL,
    credentials: true,
  });
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = Number(new URL(env.API_BASE_URL).port || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on ${env.API_BASE_URL}`);
}

void bootstrap();
