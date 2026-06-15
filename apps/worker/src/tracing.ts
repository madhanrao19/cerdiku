// Imported first in main.ts so tracing starts before instrumented modules load.
import { initTracing } from '@kpm/observability';

initTracing('kpm-worker');
