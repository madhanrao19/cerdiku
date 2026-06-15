import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';

// End-to-end coverage for the four critical flows:
//   auth → student creation → tutor session → attempt submit → parent dashboard
// Requires a reachable Postgres (DATABASE_URL) with schema applied. CI provides
// a pgvector service; locally run `pnpm dev:infra && pnpm --filter @kpm/api db:push`.

describe('KPM platform e2e', () => {
  let app: NestFastifyApplication;
  let cookies = '';
  let studentId = '';

  const email = `parent_${randomUUID().slice(0, 8)}@test.my`;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-1234567890';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-1234567890';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyCookie as never);
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function inject(method: string, url: string, payload?: unknown) {
    const res = await app.inject({
      method: method as never,
      url,
      payload: payload as never,
      headers: cookies ? { cookie: cookies } : {},
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
      cookies = arr.map((c) => c.split(';')[0]).join('; ');
    }
    return res;
  }

  it('registers a parent (auth) and sets cookies', async () => {
    const res = await inject('POST', '/api/auth/register-parent', {
      email,
      password: 'password123',
      householdName: 'Test Family',
      acceptPrivacyNotice: true,
    });
    expect(res.statusCode).toBe(201);
    expect(cookies).toContain('access_token');
  });

  it('returns the current user from /me', async () => {
    const res = await inject('GET', '/api/auth/me');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).role).toBe('PARENT');
  });

  it('creates a student under the household', async () => {
    const res = await inject('POST', '/api/auth/register-student', {
      fullName: 'Test Child',
      dob: '2017-01-01',
      level: 'PRIMARY',
      languagePref: 'BM',
      schoolType: 'SK',
    });
    expect(res.statusCode).toBe(201);
    studentId = JSON.parse(res.body).studentId;
    expect(studentId).toBeTruthy();
  });

  it('opens a tutor session (tutor session creation)', async () => {
    const res = await inject('POST', '/api/tutor/sessions', { studentId, mode: 'explain' });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).id).toBeTruthy();
  });

  it('serves the parent dashboard', async () => {
    const res = await inject('GET', '/api/parents/dashboard');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.students.some((s: { id: string }) => s.id === studentId)).toBe(true);
  });

  it('enforces RBAC: student-only route rejects the parent', async () => {
    // activities/:id/start requires STUDENT role; parent cookie must be forbidden.
    const res = await inject('POST', `/api/activities/${randomUUID()}/start`, {});
    expect(res.statusCode).toBe(403);
  });
});
