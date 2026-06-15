import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CurriculumModule } from './curriculum/curriculum.module.js';
import { LearningModule } from './learning/learning.module.js';
import { TutorModule } from './tutor/tutor.module.js';
import { ParentsModule } from './parents/parents.module.js';
import { AdminModule } from './admin/admin.module.js';
import { BillingModule } from './billing/billing.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { HealthController } from './health.controller.js';
import { JwtAuthGuard } from './common/rbac.js';

@Module({
  imports: [
    // JwtModule is global here so the guard can verify tokens everywhere.
    JwtModule.register({ global: true }),
    // Global rate limiting (default 120 req/min/IP). Per-route overrides tighten
    // auth + tutor. In-memory store is fine for a single instance; for multi
    // instance, swap in @nest-lab/throttler-storage-redis (see docs).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AiModule,
    AuditModule,
    AuthModule,
    CurriculumModule,
    LearningModule,
    TutorModule,
    ParentsModule,
    AdminModule,
    BillingModule,
    PrivacyModule,
  ],
  controllers: [HealthController],
  providers: [
    // Rate limiter runs first to shed floods before auth work happens.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global auth/RBAC guard. Routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
