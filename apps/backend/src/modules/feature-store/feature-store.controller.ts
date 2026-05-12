import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FeatureStoreService, FeatureSet } from './feature-store.service';

@ApiTags('feature-store')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/admin/feature-store')
export class FeatureStoreController {
  constructor(private readonly featureStore: FeatureStoreService) {}

  @Get('training-batch')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Export a training batch of feature vectors (admin only)' })
  @ApiQuery({ name: 'featureSet', enum: ['scoring', 'pricing', 'fraud', 'engagement', 'graph'], required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async trainingBatch(
    @Query('featureSet') featureSet: FeatureSet,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50_000) : 10_000;
    return this.featureStore.fetchTrainingBatch(featureSet, parsedLimit);
  }
}
