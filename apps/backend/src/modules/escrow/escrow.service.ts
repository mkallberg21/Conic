import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EscrowStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EscrowProvider } from './escrow.provider';

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: EscrowProvider,
    private readonly audit: AuditService,
  ) {}

  /** Escrow status for a contract — visible to both parties (and admins). */
  async getForContract(userId: string, role: UserRole, contractId: string) {
    const contract = await this.loadContractForParty(userId, role, contractId);
    const escrow = await this.prisma.escrow.findUnique({ where: { contractId } });
    return { escrow, fundable: contract.totalValue > 0 };
  }

  /** Brand deposits the contract value into escrow, held until work is approved. */
  async fund(brandUserId: string, contractId: string) {
    const { brand, contract } = await this.requireBrandContract(brandUserId, contractId);

    const existing = await this.prisma.escrow.findUnique({ where: { contractId } });
    if (existing && existing.status !== EscrowStatus.PENDING_FUNDING) {
      throw new BadRequestException(`Escrow is already ${existing.status.toLowerCase()}.`);
    }

    const move = await this.provider.hold(contract.totalValue, brand.id);
    const data = {
      brandId: brand.id,
      amountCents: contract.totalValue,
      currency: contract.currency,
      status: EscrowStatus.FUNDED,
      provider: this.provider.name,
      providerRef: move.providerRef,
      fundedAt: new Date(),
    };
    const escrow = await this.prisma.escrow.upsert({
      where: { contractId },
      update: data,
      create: { contractId, ...data },
    });
    void this.audit.log({ userId: brandUserId, action: 'ESCROW_FUNDED', resource: 'Escrow', resourceId: escrow.id, newValue: { amountCents: contract.totalValue } });
    return escrow;
  }

  /** Release held funds to the creator (after the brand approves the work). */
  async release(brandUserId: string, contractId: string) {
    const escrow = await this.requireFundedEscrow(brandUserId, contractId);
    await this.provider.release(escrow.providerRef);
    const updated = await this.prisma.escrow.update({
      where: { id: escrow.id },
      data: { status: EscrowStatus.RELEASED, releasedAt: new Date() },
    });
    void this.audit.log({ userId: brandUserId, action: 'ESCROW_RELEASED', resource: 'Escrow', resourceId: escrow.id });
    return updated;
  }

  /** Return held funds to the brand (e.g. the deal fell through). */
  async refund(brandUserId: string, contractId: string) {
    const escrow = await this.requireFundedEscrow(brandUserId, contractId);
    await this.provider.refund(escrow.providerRef);
    const updated = await this.prisma.escrow.update({
      where: { id: escrow.id },
      data: { status: EscrowStatus.REFUNDED, refundedAt: new Date() },
    });
    void this.audit.log({ userId: brandUserId, action: 'ESCROW_REFUNDED', resource: 'Escrow', resourceId: escrow.id });
    return updated;
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async requireFundedEscrow(brandUserId: string, contractId: string) {
    await this.requireBrandContract(brandUserId, contractId);
    const escrow = await this.prisma.escrow.findUnique({ where: { contractId } });
    if (!escrow) throw new NotFoundException('No escrow for this contract');
    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new BadRequestException(`Escrow must be funded first (currently ${escrow.status.toLowerCase()}).`);
    }
    return escrow;
  }

  private async requireBrandContract(brandUserId: string, contractId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId }, select: { id: true } });
    if (!brand) throw new ForbiddenException('Brand profile required');
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, brandId: true, totalValue: true, currency: true },
    });
    if (!contract || contract.brandId !== brand.id) throw new NotFoundException('Contract not found');
    return { brand, contract };
  }

  private async loadContractForParty(userId: string, role: UserRole, contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, totalValue: true, brand: { select: { userId: true } }, creator: { select: { userId: true } } },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    const isParty = contract.brand.userId === userId || contract.creator.userId === userId || role === UserRole.ADMIN;
    if (!isParty) throw new ForbiddenException('You are not a party to this contract');
    return contract;
  }
}
