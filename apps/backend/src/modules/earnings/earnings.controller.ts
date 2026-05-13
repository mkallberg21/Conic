import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { EarningsService } from './earnings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('earnings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('earnings')
export class EarningsController {
  constructor(private readonly svc: EarningsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'YTD earnings, pending payments, pipeline, and tax estimate' })
  getSummary(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.getSummary(userId, role);
  }

  @Get('breakdown')
  @ApiOperation({ summary: 'Monthly earnings breakdown for a given year' })
  @ApiQuery({ name: 'year', required: false })
  getBreakdown(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
  ) {
    return this.svc.getBreakdown(userId, role, year);
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Active and pending contracts/deals in the earnings pipeline' })
  getPipeline(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.getPipeline(userId, role);
  }
}
