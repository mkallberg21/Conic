import {
  Controller, Get, Patch, Post, Body, UseGuards, Version, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreatorsService } from './creators.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('creators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('creators')
@Version('1')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  @ApiOperation({ summary: 'Discover creators with advanced filters' })
  @ApiQuery({ name: 'q', required: false, description: 'Full-text search (handle, bio, niche)' })
  @ApiQuery({ name: 'niche', required: false })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'minFollowers', required: false, type: Number })
  @ApiQuery({ name: 'maxFollowers', required: false, type: Number })
  @ApiQuery({ name: 'minEngagement', required: false, type: Number })
  @ApiQuery({ name: 'maxEngagement', required: false, type: Number })
  @ApiQuery({ name: 'minPerformanceScore', required: false, type: Number })
  @ApiQuery({ name: 'maxFraudScore', required: false, type: Number })
  @ApiQuery({ name: 'pricingTier', required: false, enum: ['budget', 'mid', 'premium', 'celebrity'] })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'trending', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async findAll(
    @Query('q') q?: string,
    @Query('niche') niche?: string,
    @Query('platform') platform?: string,
    @Query('minFollowers') minFollowers?: number,
    @Query('maxFollowers') maxFollowers?: number,
    @Query('minEngagement') minEngagement?: number,
    @Query('maxEngagement') maxEngagement?: number,
    @Query('minPerformanceScore') minPerformanceScore?: number,
    @Query('maxFraudScore') maxFraudScore?: number,
    @Query('pricingTier') pricingTier?: string,
    @Query('isVerified') isVerified?: string,
    @Query('trending') trending?: string,
    @Query('page') page?: number,
    @Query('take') take?: number,
  ) {
    return this.creatorsService.discover({
      q, niche, platform,
      minFollowers: minFollowers ? Number(minFollowers) : undefined,
      maxFollowers: maxFollowers ? Number(maxFollowers) : undefined,
      minEngagement: minEngagement ? Number(minEngagement) : undefined,
      maxEngagement: maxEngagement ? Number(maxEngagement) : undefined,
      minPerformanceScore: minPerformanceScore ? Number(minPerformanceScore) : undefined,
      maxFraudScore: maxFraudScore ? Number(maxFraudScore) : undefined,
      pricingTier,
      isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
      trending: trending !== undefined ? trending === 'true' : undefined,
      page: page ? Number(page) : 1,
      take: take ? Number(take) : 24,
    });
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Get my creator profile' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.creatorsService.findByUserId(userId);
  }

  @Get('me/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Get creator dashboard statistics' })
  async getStats(@CurrentUser('id') userId: string) {
    const creator = await this.creatorsService.findByUserId(userId);
    return this.creatorsService.getDashboardStats(creator.id);
  }

  @Get('me/rate-card')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Get my rate card' })
  async getMyRateCard(@CurrentUser('id') userId: string) {
    const creator = await this.creatorsService.findByUserId(userId);
    return this.creatorsService.getRateCard(creator.id);
  }

  @Patch('me/rate-card')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Update rate card (cents per content type)' })
  async updateRateCard(
    @CurrentUser('id') userId: string,
    @Body() rateCard: Record<string, number>,
  ) {
    return this.creatorsService.updateRateCard(userId, rateCard);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Update creator profile' })
  async update(
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateCreatorDto>,
  ) {
    return this.creatorsService.update(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get creator by ID' })
  async findOne(@Param('id') id: string) {
    return this.creatorsService.findById(id);
  }

  @Get(':id/rate-card')
  @ApiOperation({ summary: 'Get creator rate card' })
  async getRateCard(@Param('id') id: string) {
    return this.creatorsService.getRateCard(id);
  }

  @Post(':id/score')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enqueue background AI scoring for a creator' })
  async enqueueScoring(@Param('id') id: string) {
    await this.creatorsService.enqueueScoring(id);
    return { queued: true, creatorId: id };
  }
}

