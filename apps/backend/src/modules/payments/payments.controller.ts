import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List payments for current user (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('page') page = 1,
    @Query('take') take = 25,
  ) {
    return this.paymentsService.findAll(userId, role, Number(page), Number(take));
  }

  @Post(':id/release')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Release a payment to creator (Brand only)' })
  async release(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.release(id, userId);
  }

  @Get('dwolla/onboarding')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Get Dwolla Drop-in client token for bank account setup (Creator only)' })
  async getOnboardingToken(@CurrentUser('id') userId: string) {
    return this.paymentsService.getDwollaOnboardingToken(userId);
  }
}
