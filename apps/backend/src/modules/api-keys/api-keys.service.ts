import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-keys.dto';

/** All valid API key scopes */
export const API_KEY_SCOPES = [
  'read:contracts',
  'write:contracts',
  'read:campaigns',
  'write:campaigns',
  'read:creators',
  'read:analytics',
  'write:deliverables',
  'read:payments',
  'read:nil',
  'write:nil',
] as const;

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateApiKeyDto, userId: string): Promise<{ key: string; record: object }> {
    // Generate cryptographically secure key: sk_live_<40 random hex chars>
    const rawKey = `sk_live_${crypto.randomBytes(20).toString('hex')}`;
    const prefix = rawKey.slice(0, 16); // sk_live_XXXXXXXX
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        prefix,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'api_key.created',
      resource: 'ApiKey',
      resourceId: record.id,
      metadata: { name: dto.name, scopes: dto.scopes },
    });

    // Return the raw key ONCE — never stored again
    return { key: rawKey, record };
  }

  async update(id: string, dto: UpdateApiKeyDto, userId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) throw new ForbiddenException('Not your API key');
    return this.prisma.apiKey.update({ where: { id }, data: dto });
  }

  async revoke(id: string, userId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) throw new ForbiddenException('Not your API key');
    await this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    await this.auditService.log({
      userId,
      action: 'api_key.revoked',
      resource: 'ApiKey',
      resourceId: id,
    });
    return { success: true };
  }

  async findAllForUser(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        requestCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Called by API key authentication guard to validate + rate-track usage */
  async validateAndTrack(rawKey: string): Promise<{ userId: string; scopes: string[] } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });

    if (!record || !record.isActive) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Async track — fire and forget (no await to keep auth fast)
    void this.prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
    });

    return { userId: record.userId, scopes: record.scopes };
  }
}
