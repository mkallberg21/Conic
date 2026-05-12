export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '4000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    env: process.env.NODE_ENV ?? 'development',
  },
  database: {
    // In production, DATABASE_URL must include ?sslmode=require (enforced at connection time by Prisma)
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    // RS256 asymmetric (production) — base64-encoded PEM
    privateKey: process.env.JWT_PRIVATE_KEY
      ? Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8')
      : undefined,
    publicKey: process.env.JWT_PUBLIC_KEY
      ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
      : undefined,
    // HS256 symmetric fallback (dev only)
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  encryption: {
    // Active key version for new writes. Set to 'v2' during rotation.
    activeVersion: process.env.ENCRYPTION_ACTIVE_VERSION ?? 'v1',
  },
  dwolla: {
    key: process.env.DWOLLA_KEY,
    secret: process.env.DWOLLA_SECRET,
    environment: process.env.DWOLLA_ENVIRONMENT ?? 'sandbox',
    masterFundingSourceUrl: process.env.DWOLLA_MASTER_FUNDING_SOURCE_URL,
    platformFeeRate: parseFloat(process.env.PLATFORM_FEE_RATE ?? '0.05'),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/v1/auth/google/callback',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    internalSecret: process.env.INTERNAL_API_SECRET,
    contractAiUrl: process.env.CONTRACT_AI_URL ?? 'http://localhost:8001',
    deliverableAiUrl: process.env.DELIVERABLE_AI_URL ?? 'http://localhost:8002',
    creatorGraphUrl: process.env.CREATOR_GRAPH_URL ?? 'http://localhost:8003',
    pricingEngineUrl: process.env.PRICING_ENGINE_URL ?? 'http://localhost:8004',
    campaignAgentUrl: process.env.CAMPAIGN_AGENT_URL ?? 'http://localhost:8005',
    performancePredictionUrl: process.env.PERFORMANCE_PREDICTION_AI_URL ?? 'http://localhost:8006',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.AWS_REGION ?? 'us-east-1',
  },
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'noreply@conic.io',
  },
  telemetry: {
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT ?? '9464', 10),
  },
});
