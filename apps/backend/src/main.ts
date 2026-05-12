// ── OpenTelemetry MUST be imported first — before any other module ────────────
import './common/telemetry/tracing';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SensitiveDataInterceptor } from './common/interceptors/sensitive-data.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 4000);
  const corsOrigin = configService.get<string>('app.corsOrigin', 'http://localhost:3000');
  const isProd = configService.get<string>('app.env') === 'production';

  // ── Security headers (Helmet) ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fastify = app.getHttpAdapter().getInstance() as any;
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],   // inline styles needed for Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,  // required for Swagger UI iframes
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  });

  // ── HTTPS redirect in production ───────────────────────────────────────────
  if (isProd) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastify.addHook('onRequest', (request: any, reply: any, done: () => void) => {
      const proto: string | string[] | undefined = request.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        const host: string = request.headers['host'] ?? 'app.conic.io';
        void reply.redirect(`https://${host}${request.url as string}`, 301);
        return;
      }
      done();
    });
  }

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow no-origin (server-to-server) and explicitly allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,   // preflight cache 24 h
  });

  // ── Global prefix & versioning ─────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Global pipes ───────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Prevent prototype pollution via class-validator
      stopAtFirstError: false,
    }),
  );

  // ── Global filters & interceptors ─────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new SensitiveDataInterceptor());

  // ── Swagger (non-production only, or behind auth in prod) ─────────────────
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Conic API')
      .setDescription('Conic creator partnership platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`📖 Swagger docs at http://0.0.0.0:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Conic API running on http://0.0.0.0:${port}`);
}

bootstrap();
