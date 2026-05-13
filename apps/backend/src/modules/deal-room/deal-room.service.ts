import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DealRoomMessageType, DealRoomStatus, ProposalStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AiService } from '../ai/ai.service';
import { OpenDealRoomDto, PostMessageDto, CreateProposalDto } from './dto/deal-room.dto';

@Injectable()
export class DealRoomService {
  private readonly logger = new Logger(DealRoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly aiService: AiService,
  ) {}

  // ─── Open / Get ────────────────────────────────────────────────────────────

  async openRoom(callerId: string, callerRole: UserRole, dto: OpenDealRoomDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: {
        brand: true,
        creator: true,
        dealRoom: true,
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    await this.assertContractAccess(contract, callerId, callerRole);

    if (contract.dealRoom) return contract.dealRoom;

    const room = await this.prisma.dealRoom.create({
      data: { contractId: dto.contractId },
    });

    // Post a system message summarising the contract
    await this.prisma.dealRoomMessage.create({
      data: {
        dealRoomId: room.id,
        authorId: callerId,
        content: `Deal Room opened for contract "${contract.title}". Use this space to negotiate terms, propose changes, and reach agreement before signing.`,
        type: DealRoomMessageType.SYSTEM,
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'DEAL_ROOM_OPENED',
      resource: 'DealRoom',
      resourceId: room.id,
      newValue: { contractId: dto.contractId },
    });

    return room;
  }

  async getRoom(contractId: string, callerId: string, callerRole: UserRole) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { brand: true, creator: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    await this.assertContractAccess(contract, callerId, callerRole);

    const room = await this.prisma.dealRoom.findUnique({
      where: { contractId },
      include: {
        messages: {
          include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        proposals: {
          include: { proposedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!room) throw new NotFoundException('No deal room open for this contract');
    return room;
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  async postMessage(contractId: string, callerId: string, callerRole: UserRole, dto: PostMessageDto) {
    const room = await this.getRoomOrThrow(contractId, callerId, callerRole);

    if (room.status !== DealRoomStatus.OPEN) {
      throw new BadRequestException('Deal room is not open');
    }

    const message = await this.prisma.dealRoomMessage.create({
      data: {
        dealRoomId: room.id,
        authorId: callerId,
        content: dto.content,
        clauseRef: dto.clauseRef,
        type: dto.type ?? DealRoomMessageType.COMMENT,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
    });

    return message;
  }

  // ─── Proposals ─────────────────────────────────────────────────────────────

  async createProposal(contractId: string, callerId: string, callerRole: UserRole, dto: CreateProposalDto) {
    const room = await this.getRoomOrThrow(contractId, callerId, callerRole);
    if (room.status !== DealRoomStatus.OPEN) {
      throw new BadRequestException('Deal room is not open');
    }

    // Ask the AI to score the risk impact of proposed changes
    let aiRiskDelta: number | undefined;
    let aiSummary: string | undefined;
    try {
      const riskRes = await this.aiService.scoreContractRisk({
        content: dto.changes.map((c) => `PROPOSED CHANGE to ${c.clauseType}: ${c.proposed}`).join('\n\n'),
      });
      aiRiskDelta = riskRes?.riskScore ?? undefined;
      aiSummary = riskRes?.riskFlags?.join('; ') ?? undefined;
    } catch (err) {
      this.logger.warn(`AI risk scoring failed for proposal: ${String(err)}`);
    }

    const proposal = await this.prisma.dealRoomProposal.create({
      data: {
        dealRoomId: room.id,
        proposedById: callerId,
        title: dto.title,
        changes: dto.changes,
        aiRiskDelta,
        aiSummary,
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Post a system message about the proposal
    await this.prisma.dealRoomMessage.create({
      data: {
        dealRoomId: room.id,
        authorId: callerId,
        content: `Proposal submitted: "${dto.title}"${aiSummary ? ` — AI summary: ${aiSummary}` : ''}`,
        type: DealRoomMessageType.SYSTEM,
        metadata: { proposalId: proposal.id },
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: 'DEAL_ROOM_PROPOSAL_CREATED',
      resource: 'DealRoomProposal',
      resourceId: proposal.id,
      newValue: { title: dto.title, changeCount: dto.changes.length },
    });

    return proposal;
  }

  async resolveProposal(
    contractId: string,
    proposalId: string,
    callerId: string,
    callerRole: UserRole,
    resolution: 'accept' | 'reject' | 'counter',
  ) {
    const room = await this.getRoomOrThrow(contractId, callerId, callerRole);

    const proposal = await this.prisma.dealRoomProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.dealRoomId !== room.id) throw new NotFoundException('Proposal not found');
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Proposal is already resolved');
    }
    // The proposer cannot accept their own proposal
    if (resolution === 'accept' && proposal.proposedById === callerId) {
      throw new ForbiddenException('Cannot accept your own proposal');
    }

    const statusMap: Record<typeof resolution, ProposalStatus> = {
      accept: ProposalStatus.ACCEPTED,
      reject: ProposalStatus.REJECTED,
      counter: ProposalStatus.COUNTERED,
    };

    const updated = await this.prisma.dealRoomProposal.update({
      where: { id: proposalId },
      data: {
        status: statusMap[resolution],
        resolvedById: callerId,
        resolvedAt: new Date(),
      },
    });

    // If accepted, check if all parties have agreed and mark room as AGREED
    if (resolution === 'accept') {
      await this.prisma.dealRoomMessage.create({
        data: {
          dealRoomId: room.id,
          authorId: callerId,
          content: `Proposal "${proposal.title}" was accepted. Review the changes and proceed to signing when ready.`,
          type: DealRoomMessageType.ACCEPTANCE,
          metadata: { proposalId },
        },
      });
    }

    void this.auditService.log({
      userId: callerId,
      action: 'DEAL_ROOM_PROPOSAL_RESOLVED',
      resource: 'DealRoomProposal',
      resourceId: proposalId,
      newValue: { resolution, proposalTitle: proposal.title },
    });

    return updated;
  }

  async closeRoom(contractId: string, callerId: string, callerRole: UserRole, agreed: boolean) {
    const room = await this.getRoomOrThrow(contractId, callerId, callerRole);
    if (room.status !== DealRoomStatus.OPEN) {
      throw new BadRequestException('Deal room is already closed');
    }

    const updated = await this.prisma.dealRoom.update({
      where: { id: room.id },
      data: {
        status: agreed ? DealRoomStatus.AGREED : DealRoomStatus.CLOSED,
        agreedAt: agreed ? new Date() : undefined,
        closedAt: agreed ? undefined : new Date(),
      },
    });

    void this.auditService.log({
      userId: callerId,
      action: agreed ? 'DEAL_ROOM_AGREED' : 'DEAL_ROOM_CLOSED',
      resource: 'DealRoom',
      resourceId: room.id,
      newValue: { contractId, agreed },
    });

    return updated;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async getRoomOrThrow(contractId: string, callerId: string, callerRole: UserRole) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { brand: true, creator: true, dealRoom: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    await this.assertContractAccess(contract, callerId, callerRole);
    if (!contract.dealRoom) throw new NotFoundException('No deal room open for this contract');
    return contract.dealRoom;
  }

  private async assertContractAccess(
    contract: { brand: { userId: string }; creator: { userId: string } },
    callerId: string,
    callerRole: UserRole,
  ) {
    if (callerRole === UserRole.ADMIN) return;
    const isParty =
      contract.brand.userId === callerId || contract.creator.userId === callerId;
    if (!isParty) throw new ForbiddenException('You are not a party to this contract');
  }
}
