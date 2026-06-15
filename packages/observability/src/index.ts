import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';

let sdk: NodeSDK | null = null;

/**
 * Start OpenTelemetry tracing for a service.
 *
 * No-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set, so local/dev runs need no
 * collector. Auto-instruments HTTP, Fastify, pg, ioredis, etc. and exports via
 * OTLP/HTTP (Azure Monitor exporter or any OTLP collector).
 *
 * MUST be called before the instrumented modules are imported — both apps load
 * a `tracing` entry first in their bootstrap.
 *
 * NOTE: under pure ESM, some auto-instrumentations need Node started with
 * `--import @kpm/observability/register` (loader hook). Core http + libraries
 * that are CJS under the hood are patched without it.
 */
export function initTracing(serviceName: string): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || sdk) return;

  sdk = new NodeSDK({
    resource: new Resource({
      'service.name': serviceName,
      'service.namespace': 'kpm-platform',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs spans are noisy and rarely useful.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      ?.shutdown()
      .catch((err) => console.error('OTel shutdown error', err))
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
