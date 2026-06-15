import { createHmac, timingSafeEqual } from 'node:crypto';

// Generic payment-provider contract so the business logic never hard-codes a
// gateway. Malaysia-first: Billplz / Curlec (FPX, DuitNow, cards), with Stripe
// available for international billing.
export interface CheckoutResult {
  provider: string;
  checkoutUrl: string;
  externalRef: string;
}

export interface WebhookVerification {
  valid: boolean;
  eventType: string;
  externalId: string | null;
  paid: boolean;
  amount?: number;
}

export interface PaymentAdapter {
  readonly name: string;
  createCheckout(params: {
    planCode: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification;
}

// --- Billplz ---------------------------------------------------------------
export class BillplzAdapter implements PaymentAdapter {
  readonly name = 'billplz';
  constructor(
    private readonly apiKey: string,
    private readonly collectionId: string,
  ) {}

  async createCheckout(params: {
    planCode: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<CheckoutResult> {
    // Real impl calls https://www.billplz.com/api/v3/bills. Kept provider-shaped
    // but offline-safe so dev works without live keys.
    return {
      provider: this.name,
      checkoutUrl: `https://www.billplz.com/bills/${params.reference}`,
      externalRef: params.reference,
    };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification {
    const signature = headers['x-signature'] ?? '';
    const expected = createHmac('sha256', this.apiKey).update(rawBody).digest('hex');
    const valid = safeEqual(signature, expected);
    const parsed = parseForm(rawBody);
    return {
      valid,
      eventType: 'bill.paid',
      externalId: parsed['id'] ?? null,
      paid: parsed['paid'] === 'true',
      amount: parsed['amount'] ? Number(parsed['amount']) : undefined,
    };
  }
}

// --- Stripe (international fallback) ---------------------------------------
export class StripeAdapter implements PaymentAdapter {
  readonly name = 'stripe';
  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  async createCheckout(params: {
    planCode: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<CheckoutResult> {
    return {
      provider: this.name,
      checkoutUrl: `https://checkout.stripe.com/c/pay/${params.reference}`,
      externalRef: params.reference,
    };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification {
    const sig = headers['stripe-signature'] ?? '';
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const valid = sig.includes(expected) || safeEqual(sig, expected);
    let event: { type?: string; data?: { object?: { id?: string } } } = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      /* ignore */
    }
    return {
      valid,
      eventType: event.type ?? 'unknown',
      externalId: event.data?.object?.id ?? null,
      paid: event.type === 'checkout.session.completed',
    };
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of body.split('&')) {
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

export function createPaymentAdapter(env: NodeJS.ProcessEnv): PaymentAdapter {
  switch (env.PAYMENT_PROVIDER) {
    case 'stripe':
      return new StripeAdapter(env.STRIPE_SECRET_KEY ?? '', env.STRIPE_WEBHOOK_SECRET ?? '');
    case 'billplz':
    default:
      return new BillplzAdapter(env.BILLPLZ_API_KEY ?? 'dev', env.BILLPLZ_COLLECTION_ID ?? 'dev');
  }
}
