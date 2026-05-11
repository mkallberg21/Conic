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

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly aiService: AiService,
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

    return contract;
  }

  async findAll(userId: string, role: UserRole) {
    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      return this.prisma.contract.findMany({
        where: { brandId: brand?.id },
        include: {
          creator: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { deliverables: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      return this.prisma.contract.findMany({
        where: { creatorId: creator?.id },
        include: {
          brand: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { deliverables: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.contract.findMany({
      include: {
        brand: true,
        creator: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
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
    return contract;
  }

  async sign(contractId: string, userId: string, role: UserRole, ipAddress: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    if (contract.status === ContractStatus.ACTIVE) {
      throw new BadRequestException('Contract already fully executed');
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

    return updated;
  }

  async getTemplates() {
    return this.prisma.contractTemplate.findMany({
      where: { isPublic: true },
      orderBy: { usageCount: 'desc' },
    });
  }
}
