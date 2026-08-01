import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  UpdateAgentProfileDto,
  CreateRepresentationDto,
  UpdateRepresentationDto,
} from './dto/agent-profile.dto';

@Injectable()
export class AgentProfileService {
  private readonly logger = new Logger(AgentProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  // ─── Profile ─────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        representations: {
          where: { isActive: true },
          include: {
            athlete: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Agent profile not found');
    return profile;
  }

  async upsertProfile(userId: string, dto: UpdateAgentProfileDto) {
    const profile = await this.prisma.agentProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });

    await this.auditService.log({
      userId,
      action: 'agent_profile.upserted',
      resource: 'AgentProfile',
      resourceId: profile.id,
      metadata: dto as Record<string, unknown>,
    });

    return profile;
  }

  // ─── Verify (admin only) ──────────────────────────────────────────────────

  async verifyAgent(agentUserId: string, adminId: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId: agentUserId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const updated = await this.prisma.agentProfile.update({
      where: { userId: agentUserId },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'agent.verified',
      resource: 'AgentProfile',
      resourceId: profile.id,
    });

    return updated;
  }

  // ─── Representations ─────────────────────────────────────────────────────

  async addRepresentation(userId: string, dto: CreateRepresentationDto) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    // Prevent duplicate active representation
    const existing = await this.prisma.agentRepresentation.findUnique({
      where: { agentId_athleteId: { agentId: profile.id, athleteId: dto.athleteId } },
    });
    if (existing?.isActive) {
      throw new ConflictException('Active representation for this athlete already exists');
    }

    const athlete = await this.prisma.athlete.findUnique({ where: { id: dto.athleteId } });
    if (!athlete) throw new NotFoundException('Athlete not found');

    const rep = await this.prisma.agentRepresentation.upsert({
      where: { agentId_athleteId: { agentId: profile.id, athleteId: dto.athleteId } },
      create: {
        agentId: profile.id,
        athleteId: dto.athleteId,
        scope: dto.scope,
        commissionRate: dto.commissionRate ?? 0.15,
        contractUrl: dto.contractUrl,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: true,
      },
      update: {
        scope: dto.scope,
        commissionRate: dto.commissionRate ?? 0.15,
        contractUrl: dto.contractUrl,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: true,
      },
      include: {
        athlete: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'agent.representation.added',
      resource: 'AgentRepresentation',
      resourceId: rep.id,
      metadata: { athleteId: dto.athleteId, scope: dto.scope },
    });

    return rep;
  }

  async updateRepresentation(userId: string, repId: string, dto: UpdateRepresentationDto) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const rep = await this.prisma.agentRepresentation.findUnique({ where: { id: repId } });
    if (!rep) throw new NotFoundException('Representation not found');
    if (rep.agentId !== profile.id) throw new ForbiddenException('Not your representation');

    const updated = await this.prisma.agentRepresentation.update({
      where: { id: repId },
      data: {
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.commissionRate !== undefined && { commissionRate: dto.commissionRate }),
        ...(dto.contractUrl !== undefined && { contractUrl: dto.contractUrl }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        athlete: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'agent.representation.updated',
      resource: 'AgentRepresentation',
      resourceId: repId,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async terminateRepresentation(userId: string, repId: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const rep = await this.prisma.agentRepresentation.findUnique({ where: { id: repId } });
    if (!rep) throw new NotFoundException('Representation not found');
    if (rep.agentId !== profile.id) throw new ForbiddenException('Not your representation');

    const updated = await this.prisma.agentRepresentation.update({
      where: { id: repId },
      data: { isActive: false, endDate: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'agent.representation.terminated',
      resource: 'AgentRepresentation',
      resourceId: repId,
    });

    return updated;
  }

  async getRepresentations(userId: string, includeInactive = false) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    return this.prisma.agentRepresentation.findMany({
      where: {
        agentId: profile.id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        athlete: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            university: { select: { id: true, name: true, state: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // ─── Agent lookup (admin / brands) ───────────────────────────────────────

  async listAgents(page = 1, limit = 20, verifiedOnly = false) {
    const skip = (page - 1) * limit;
    const where = verifiedOnly ? { isVerified: true } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.agentProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { representations: { where: { isActive: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentProfile.count({ where }),
    ]);

    return {
      data: items.map((a) => ({ ...a, activeAthleteCount: a._count.representations })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
