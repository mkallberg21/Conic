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
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
    internalSecret: process.env.INTERNAL_API_SECRET,
    contractAiUrl: process.env.CONTRACT_AI_URL ?? 'http://localhost:8001',
    deliverableAiUrl: process.env.DELIVERABLE_AI_URL ?? 'http://localhost:8002',
    creatorGraphUrl: process.env.CREATOR_GRAPH_URL ?? 'http://localhost:8003',
    pricingEngineUrl: process.env.PRICING_ENGINE_URL ?? 'http://localhost:8004',
    campaignAgentUrl: process.env.CAMPAIGN_AGENT_URL ?? 'http://localhost:8005',
    performancePredictionUrl: process.env.PERFORMANCE_PREDICTION_AI_URL ?? 'http://localhost:8006',
    nilComplianceAiUrl: process.env.NIL_COMPLIANCE_AI_URL ?? 'http://localhost:8007',
    fraudDetectionAiUrl: process.env.FRAUD_DETECTION_AI_URL ?? 'http://localhost:8008',
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
  sms: {
    // 'twilio' when TWILIO_* creds are set; otherwise 'log' (codes are logged,
    // never sent — the phone-verification path is provider-gated).
    provider: process.env.SMS_PROVIDER ?? (process.env.TWILIO_ACCOUNT_SID ? 'twilio' : 'log'),
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  billing: {
    // 'stripe' when STRIPE_SECRET_KEY is set; otherwise 'stub' (dev activates the
    // plan immediately, no redirect). Mirrors the other provider-gated services.
    provider: process.env.BILLING_PROVIDER ?? (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'stub'),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
    checkoutSuccessUrl: process.env.BILLING_SUCCESS_URL ?? 'http://localhost:3000/plan?status=success',
    checkoutCancelUrl: process.env.BILLING_CANCEL_URL ?? 'http://localhost:3000/plan?status=cancel',
  },
  verification: {
    // 'stub' auto-resolves from self-reported DOB (dev); real vendors are switched
    // on when their API key is present — mirrors the SMS / social-verifier pattern.
    ageProvider: process.env.AGE_PROVIDER ?? (process.env.AGE_API_KEY ? 'vendor' : 'stub'),
    kybProvider: process.env.KYB_PROVIDER ?? (process.env.KYB_API_KEY ? 'vendor' : 'stub'),
    ageApiKey: process.env.AGE_API_KEY,
    kybApiKey: process.env.KYB_API_KEY,
    webhookSecret: process.env.VERIFICATION_WEBHOOK_SECRET,
    ageReverifyDays: parseInt(process.env.AGE_REVERIFY_DAYS ?? '365', 10),
    // Enforcement flags — ship the plumbing first, then flip gates on per capability.
    // Default OFF (log-only) except the minor-contact gate, which defaults ON.
    enforceAgeToList: process.env.ENFORCE_AGE_LIST === 'true',
    enforceAgeToSign: process.env.ENFORCE_AGE_SIGN === 'true',
    enforceAgeToPayout: process.env.ENFORCE_AGE_PAYOUT === 'true',
    enforceKybToTransact: process.env.ENFORCE_KYB_TRANSACT === 'true',
    enforceKybToContactMinors: process.env.ENFORCE_KYB_MINORS !== 'false',
  },
  guardian: {
    // Age below which an influencer (athlete/creator) is a minor and must have a
    // verified guardian linked before entering into any agreement.
    minorAgeThreshold: parseInt(process.env.MINOR_AGE_THRESHOLD ?? '18', 10),
    // Hours a guardian-approval request / invite stays valid.
    approvalExpiryHours: parseInt(process.env.GUARDIAN_APPROVAL_EXPIRY_HOURS ?? '72', 10),
    inviteExpiryHours: parseInt(process.env.GUARDIAN_INVITE_EXPIRY_HOURS ?? '168', 10),
  },
  telemetry: {
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT ?? '9464', 10),
  },
});
