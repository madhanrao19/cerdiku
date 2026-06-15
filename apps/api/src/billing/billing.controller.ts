import { Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SkipThrottle } from '@nestjs/throttler';
import { checkoutSessionSchema, type CheckoutSessionInput } from '@kpm/types';
import { BillingService } from './billing.service.js';
import { Public, Roles } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Roles('PARENT', 'ADMIN')
  @Post('billing/checkout-session')
  @UsePipes(new ZodValidationPipe(checkoutSessionSchema))
  checkout(@Body() body: CheckoutSessionInput) {
    return this.billing.checkout(body);
  }

  // Public + signature-verified. The raw body is required for HMAC, so we read
  // it from the Fastify request (see rawBody plugin note in main.ts).
  // Skip rate limiting — gateways legitimately burst and retry; HMAC is the gate.
  @Public()
  @SkipThrottle()
  @Post('webhooks/payments/provider')
  async webhook(@Req() req: FastifyRequest) {
    const rawBody =
      (req as FastifyRequest & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    return this.billing.handleWebhook(rawBody, req.headers as Record<string, string | undefined>);
  }
}
