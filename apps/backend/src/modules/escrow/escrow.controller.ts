import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EscrowService } from './escrow.service';

@ApiTags('escrow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrow: EscrowService) {}

  @Get('contract/:contractId')
  @Roles(UserRole.BRAND, UserRole.AGENCY, UserRole.CREATOR, UserRole.ATHLETE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Escrow status for a contract (either party)' })
  status(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('contractId') contractId: string) {
    return this.escrow.getForContract(userId, role, contractId);
  }

  @Post('contract/:contractId/fund')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Fund escrow for a contract' })
  fund(@CurrentUser('id') userId: string, @Param('contractId') contractId: string) {
    return this.escrow.fund(userId, contractId);
  }

  @Post('contract/:contractId/release')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Release held funds to the creator' })
  release(@CurrentUser('id') userId: string, @Param('contractId') contractId: string) {
    return this.escrow.release(userId, contractId);
  }

  @Post('contract/:contractId/refund')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Refund held funds to the brand' })
  refund(@CurrentUser('id') userId: string, @Param('contractId') contractId: string) {
    return this.escrow.refund(userId, contractId);
  }
}
