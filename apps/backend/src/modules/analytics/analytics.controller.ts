import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Platform-wide analytics overview (Admin only)' })
  async overview() {
    return this.analyticsService.getPlatformOverview();
  }

  @Get('campaigns')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND, UserRole.ADMIN)
  @ApiOperation({ summary: 'Campaign performance analytics for brand' })
  async campaigns(@CurrentUser('id') userId: string) {
    return this.analyticsService.getCampaignPerformance(userId);
  }

  @Get('creator')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Creator earnings and performance stats' })
  async creatorStats(@CurrentUser('id') userId: string) {
    return this.analyticsService.getCreatorStats(userId);
  }

  @Get('creators/top')
  @ApiOperation({ summary: 'Get top-performing creators' })
  async topCreators(@Query('limit') limit?: number) {
    return this.analyticsService.getTopCreators(limit);
  }

  @Get('revenue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Revenue chart data for brand' })
  async revenue(
    @CurrentUser('id') userId: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getRevenueChart(userId, days);
  }

  @Get('time-series')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND, UserRole.ADMIN)
  @ApiOperation({ summary: 'Time-series data for recharts visualisation' })
  @ApiQuery({ name: 'metric', enum: ['revenue', 'contracts', 'deliverables'], required: false })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  async timeSeries(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('metric') metric: 'revenue' | 'contracts' | 'deliverables' = 'revenue',
    @Query('days') days = 30,
  ) {
    const brandUserId = role === UserRole.BRAND ? userId : undefined;
    return this.analyticsService.getTimeSeries(metric, +days, brandUserId);
  }

  @Get('creator-comparison')
  @ApiOperation({ summary: 'Side-by-side AI score comparison for up to 5 creators' })
  @ApiQuery({ name: 'ids', description: 'Comma-separated creator IDs', required: true })
  async creatorComparison(@Query('ids') ids: string) {
    const creatorIds = ids.split(',').slice(0, 5);
    return this.analyticsService.getCreatorComparison(creatorIds);
  }
}
