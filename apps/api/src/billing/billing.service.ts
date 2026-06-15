import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CheckoutSessionInput } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';
import { createPaymentAdapter, type PaymentAdapter } from './payment.adapter.js';

const PLAN_PRICES: Record<string, number> = {
  family_monthly: 49.0,
  family_yearly: 490.0,
  single_monthly: 29.0,
};

@Injectable()
export class BillingService {
  private readonly adapter: PaymentAdapter = createPaymentAdapter(process.env);

  constructor(private readonly prisma: PrismaService) {}

  async checkout(input: CheckoutSessionInput) {
    const amount = PLAN_PRICES[input.planCode] ?? 49.0;
    const reference = randomUUID();

    const subscription = await this.prisma.subscription.create({
      data: {
        householdId: input.householdId,
        provider: this.adapter.name,
        planCode: input.planCode,
        status: 'TRIALING',
      },
    });

    const checkout = await this.adapter.createCheckout({
      planCode: input.planCode,
      amount,
      currency: 'MYR',
      reference,
    });

    await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        providerPaymentId: checkout.externalRef,
        amount,
        currency: 'MYR',
        status: 'pending',
      },
    });

    return { subscriptionId: subscription.id, ...checkout };
  }

  // Idempotent webhook processing keyed on (provider, externalId).
  async handleWebhook(rawBody: string, headers: Record<string, string | undefined>) {
    const verification = this.adapter.verifyWebhook(rawBody, headers);
    if (!verification.valid) return { ok: false, reason: 'invalid_signature' };

    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: this.adapter.name,
          eventType: verification.eventType,
          externalId: verification.externalId,
          payload: { raw: rawBody.slice(0, 4000) } as never,
          processedAt: new Date(),
        },
      });
    } catch {
      // Unique (provider, externalId) violation => already processed.
      return { ok: true, deduped: true };
    }

    if (verification.paid && verification.externalId) {
      const payment = await this.prisma.payment.findFirst({
        where: { providerPaymentId: verification.externalId },
      });
      if (payment) {
        await this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'paid', paidAt: new Date() },
          }),
          this.prisma.subscription.update({
            where: { id: payment.subscriptionId },
            data: {
              status: 'ACTIVE',
              currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
            },
          }),
        ]);
      }
    }
    return { ok: true };
  }
}
