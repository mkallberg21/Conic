import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ContractStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly aiService: AiService,
    private readonly auditService: AuditService,
  ) {}

  async create(brandUserId: string, dto: CreateContractDto) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    if (!brand) throw new ForbiddenException('Brand profile required');

    const creator = await this.prisma.creator.findUnique({ where: { id: dto.creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    // Generate contract content via AI
    const aiContent = await this.aiService.generateContractContent({
      campaignType: 'influencer_post',
      platforms: dto.platforms,
      usageRights: dto.usageRights ?? 'Standard usage',
      exclusivity: dto.exclusivity ?? false,
      exclusivityDays: dto.exclusivityDays,
      totalValue: dto.totalValue,
    });

    const contract = await this.prisma.contract.create({
      data: {
        brandId: brand.id,
        creatorId: dto.creatorId,
        title: dto.title,
        content: aiContent.content,
        templateId: dto.templateId,
        usageRights: dto.usageRights,
        exclusivity: dto.exclusivity ?? false,
        exclusivityDays: dto.exclusivityDays,
        platforms: dto.platforms,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        totalValue: dto.totalValue,
        currency: dto.currency ?? 'USD',
        riskScore: aiContent.riskScore,
        riskFlags: aiContent.riskFlags,
        milestones: dto.milestones
          ? {
              createMany: {
                data: dto.milestones.map((m) => ({
                  title: m.title,
                  description: m.description,
                  amount: m.amount,
                  dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
                  position: m.position,
                })),
              },
            }
          : undefined,
      },
      include: {
        brand: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        creator: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        milestones: true,
      },
    });

    this.eventBus.emit(EVENTS.CONTRACT_CREATED, {
      contractId: contract.id,
      brandId: brand.id,
      creatorId: dto.creatorId,
      totalValue: dto.totalValue,
    });

    void this.auditService.log({
      userId: brandUserId,
      action: 'CONTRACT_CREATED',
      resource: 'Contract',
      resourceId: contract.id,
      newValue: { title: dto.title, totalValue: dto.totalValue, creatorId: dto.creatorId },
    });

    return contract;
  }

  async findAll(userId: string, role: UserRole, page = 1, take = 25) {
    const skip = (page - 1) * Math.min(take, 100);
    const limit = Math.min(take, 100);

    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      if (!brand) return [];
      return this.prisma.contract.findMany({
        where: { brandId: brand.id },
        include: {
          creator: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { deliverables: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });
    }

    if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      if (!creator) return [];
      return this.prisma.contract.findMany({
        where: { creatorId: creator.id },
        include: {
          brand: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { deliverables: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });
    }

    return this.prisma.contract.findMany({
      include: {
        brand: true,
        creator: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async findById(id: string, userId: string, role: UserRole) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        brand: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        creator: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        deliverables: true,
        payments: true,
        milestones: { orderBy: { position: 'asc' } },
        clauses: { orderBy: { position: 'asc' } },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    // Enforce object-level authorization — ADMIN sees all
    if (role !== UserRole.ADMIN) {
      const allowed = await this.userOwnsContract(userId, role, contract);
      if (!allowed) throw new ForbiddenException('Access denied');
    }

    return contract;
  }

  async sign(contractId: string, userId: string, role: UserRole, ipAddress: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    if (contract.status === ContractStatus.ACTIVE) {
      throw new BadRequestException('Contract already fully executed');
    }

    // Verify the signer actually owns their side of this contract
    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      if (!brand || contract.brandId !== brand.id) {
        throw new ForbiddenException('You are not the brand party to this contract');
      }
    } else if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      if (!creator || contract.creatorId !== creator.id) {
        throw new ForbiddenException('You are not the creator party to this contract');
      }
    } else {
      throw new ForbiddenException('Only brand or creator parties can sign a contract');
    }

    const updateData: Record<string, unknown> = {};

    if (role === UserRole.BRAND) {
      if (contract.brandSignedAt) throw new BadRequestException('Brand already signed');
      updateData.brandSignedAt = new Date();
      updateData.brandSignerIp = ipAddress;
    } else if (role === UserRole.CREATOR) {
      if (contract.creatorSignedAt) throw new BadRequestException('Creator already signed');
      updateData.creatorSignedAt = new Date();
      updateData.creatorSignerIp = ipAddress;
    }

    const brandSigned = role === UserRole.BRAND || !!contract.brandSignedAt;
    const creatorSigned = role === UserRole.CREATOR || !!contract.creatorSignedAt;

    if (brandSigned && creatorSigned) {
      updateData.status = ContractStatus.ACTIVE;
    } else {
      updateData.status = ContractStatus.PENDING_SIGNATURE;
    }

    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: updateData,
    });

    this.eventBus.emit(EVENTS.CONTRACT_SIGNED, {
      contractId,
      signedBy: role === UserRole.BRAND ? 'brand' : 'creator',
      fullyExecuted: brandSigned && creatorSigned,
    });

    void this.auditService.log({
      userId,
      action: 'CONTRACT_SIGNED',
      resource: 'Contract',
      resourceId: contractId,
      newValue: {
        signedBy: role === UserRole.BRAND ? 'brand' : 'creator',
        fullyExecuted: brandSigned && creatorSigned,
        status: updated.status,
      },
      ipAddress,
    });

    return updated;
  }

  async dispute(contractId: string, userId: string, role: UserRole, reason: string, ipAddress: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Only active contracts can be disputed');
    }

    // Only the brand or creator party to this contract may raise a dispute
    const allowed = await this.userOwnsContract(userId, role, contract);
    if (!allowed) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.DISPUTED },
    });

    void this.auditService.log({
      userId,
      action: 'CONTRACT_DISPUTED',
      resource: 'Contract',
      resourceId: contractId,
      newValue: { reason, previousStatus: ContractStatus.ACTIVE },
      ipAddress,
    });

    this.eventBus.emit(EVENTS.CONTRACT_DISPUTED, {
      contractId,
      reason,
      disputedBy: userId,
    });

    return updated;
  }

  async getActivity(contractId: string, userId: string, role: UserRole) {
    // Ensure contract exists and requester is a party (or admin)
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, brandId: true, creatorId: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    if (role !== UserRole.ADMIN) {
      const allowed = await this.userOwnsContract(userId, role, contract);
      if (!allowed) throw new ForbiddenException('Access denied');
    }

    // Gather related deliverable and payment IDs
    const [deliverables, payments] = await Promise.all([
      this.prisma.deliverable.findMany({ where: { contractId }, select: { id: true, title: true } }),
      this.prisma.payment.findMany({ where: { contractId }, select: { id: true } }),
    ]);

    const deliverableIds = deliverables.map((d) => d.id);
    const paymentIds = payments.map((p) => p.id);
    const deliverableTitles = Object.fromEntries(deliverables.map((d) => [d.id, d.title]));

    const entries = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { resource: 'Contract', resourceId: contractId },
          ...(deliverableIds.length ? [{ resource: 'Deliverable', resourceId: { in: deliverableIds } }] : []),
          ...(paymentIds.length ? [{ resource: 'Payment', resourceId: { in: paymentIds } }] : []),
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return entries.map((e) => ({
      ...e,
      resourceLabel:
        e.resource === 'Deliverable' && e.resourceId
          ? (deliverableTitles[e.resourceId] ?? e.resource)
          : e.resource,
    }));
  }

  async getTemplates() {
    return this.prisma.contractTemplate.findMany({
      where: { isPublic: true },
      orderBy: { usageCount: 'desc' },
    });
  }

  /**
   * Returns true if `userId` with `role` is a party to the contract.
   * Used for BOLA/IDOR defence on findById, getActivity, dispute.
   */
  private async userOwnsContract(
    userId: string,
    role: UserRole,
    contract: { brandId: string; creatorId: string },
  ): Promise<boolean> {
    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      return !!brand && brand.id === contract.brandId;
    }
    if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      return !!creator && creator.id === contract.creatorId;
    }
    // AGENCY — not a direct party; deny by default
    return false;
  }
}

