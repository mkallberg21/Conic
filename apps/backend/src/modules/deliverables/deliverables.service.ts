import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DeliverableStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { AiService } from '../ai/ai.service';
import {
  CreateDeliverableDto,
  SubmitDeliverableDto,
  ReviewDeliverableDto,
} from './dto/create-deliverable.dto';

@Injectable()
export class DeliverablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly aiService: AiService,
  ) {}

  async create(userId: string, role: UserRole, dto: CreateDeliverableDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: { brand: true, creator: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException('Contract must be active to add deliverables');
    }

    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      if (contract.brandId !== brand?.id) throw new ForbiddenException();
    }

    return this.prisma.deliverable.create({
      data: {
        contractId: dto.contractId,
        creatorId: contract.creatorId,
        title: dto.title,
        description: dto.description,
        platform: dto.platform,
        contentType: dto.contentType,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async findAll(userId: string, role: UserRole) {
    if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      return this.prisma.deliverable.findMany({
        where: { creatorId: creator?.id },
        include: {
          contract: {
            include: {
              brand: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });
    }

    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      return this.prisma.deliverable.findMany({
        where: { contract: { brandId: brand?.id } },
        include: {
          creator: { include: { user: { select: { firstName: true, lastName: true } } } },
          contract: { select: { id: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
    }

    return this.prisma.deliverable.findMany({
      include: {
        creator: true,
        contract: { select: { id: true, title: true, brandId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submit(deliverableId: string, creatorUserId: string, dto: SubmitDeliverableDto) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: creatorUserId } });
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
    });

    if (!deliverable) throw new NotFoundException('Deliverable not found');
    if (deliverable.creatorId !== creator?.id) throw new ForbiddenException();
    if (deliverable.status === DeliverableStatus.APPROVED) {
      throw new BadRequestException('Deliverable already approved');
    }

    const updated = await this.prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        proofUrl: dto.proofUrl,
        proofType: dto.proofType,
        caption: dto.caption,
        hashtags: dto.hashtags ?? [],
        mentions: dto.mentions ?? [],
        postUrl: dto.postUrl,
        status: DeliverableStatus.SUBMITTED,
        submittedAt: new Date(),
        verificationStatus: 'PENDING',
      },
    });

    this.eventBus.emit(EVENTS.DELIVERABLE_SUBMITTED, {
      deliverableId,
      contractId: deliverable.contractId,
      creatorId: deliverable.creatorId,
      proofUrl: dto.proofUrl,
    });

    // Trigger async AI verification
    this.aiService.verifyDeliverable(deliverableId, {
      proofUrl: dto.proofUrl,
      platform: deliverable.platform,
      contentType: deliverable.contentType,
      requiredHashtags: [],
      requiredMentions: [],
      caption: dto.caption,
    }).catch((err) => console.error('AI verification error:', err));

    return updated;
  }

  async review(deliverableId: string, brandUserId: string, dto: ReviewDeliverableDto) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: { contract: true },
    });

    if (!deliverable) throw new NotFoundException('Deliverable not found');
    if (deliverable.contract.brandId !== brand?.id) throw new ForbiddenException();
    if (deliverable.status !== DeliverableStatus.SUBMITTED && deliverable.status !== DeliverableStatus.UNDER_REVIEW) {
      throw new BadRequestException('Deliverable is not pending review');
    }

    const statusMap: Record<string, DeliverableStatus> = {
      APPROVED: DeliverableStatus.APPROVED,
      REJECTED: DeliverableStatus.REJECTED,
      REVISION_REQUESTED: DeliverableStatus.REVISION_REQUESTED,
    };

    const updated = await this.prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        status: statusMap[dto.action],
        approvedAt: dto.action === 'APPROVED' ? new Date() : undefined,
        rejectedAt: dto.action === 'REJECTED' ? new Date() : undefined,
        rejectionReason: dto.rejectionReason,
      },
    });

    if (dto.action === 'APPROVED') {
      this.eventBus.emit(EVENTS.DELIVERABLE_APPROVED, {
        deliverableId,
        contractId: deliverable.contractId,
        paymentAmount: deliverable.paymentAmount ?? 0,
      });
    }

    return updated;
  }
}
