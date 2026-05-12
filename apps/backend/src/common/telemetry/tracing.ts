/**
 * OpenTelemetry SDK bootstrap.
 *
 * This file MUST be required/imported before any other module so that
 * auto-instrumentation patches Node.js core modules at startup.
 *
 * Usage in main.ts:
 *   import './common/telemetry/tracing';
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

const OTEL_EXPORTER_URL =
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

const PROMETHEUS_PORT = parseInt(process.env['PROMETHEUS_PORT'] ?? '9464', 10);

/**
 * Prometheus scrape endpoint on a dedicated port so it stays separate
 * from the application port and does not appear in public routing.
 */
const prometheusExporter = new PrometheusExporter({
  port: PROMETHEUS_PORT,
  endpoint: '/metrics',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'conic-backend',
    [SEMRESATTRS_SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.1.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] ?? 'development',
  }),

  // ── Tracing ──────────────────────────────────────────────────────────────
  traceExporter: new OTLPTraceExporter({
    url: `${OTEL_EXPORTER_URL}/v1/traces`,
  }),

  // ── Metrics ──────────────────────────────────────────────────────────────
  // Dual export: Prometheus scrape + OTLP push (Grafana Cloud / Mimir).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${OTEL_EXPORTER_URL}/v1/metrics`,
    }),
    exportIntervalMillis: 15_000,
  }) as any,

  instrumentations: [
    getNodeAutoInstrumentations({
      // Avoid noisy fs span spam in development.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-fastify': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
  ],
});

// Start the SDK — must be synchronous to guarantee patch ordering.
sdk.start();

// Export the prometheus exporter so it can be referenced if needed.
export { prometheusExporter };

// Graceful shutdown.
process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => {});
});
