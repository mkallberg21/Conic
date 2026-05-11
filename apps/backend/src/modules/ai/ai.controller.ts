import {
  Controller, Post, Body, Param, UseGuards, Version, Get,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
@Version('1')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('creators/:id/predict')
  @ApiOperation({ summary: 'Get AI performance prediction for a creator' })
  async predictCreator(@Param('id') id: string) {
    return this.aiService.predictCreatorPerformance(id);
  }

  @Post('pricing/recommend')
  @ApiOperation({ summary: 'Get AI pricing recommendation' })
  async pricing(
    @Body()
    body: {
      platform: string;
      contentType: string;
      niche: string[];
      followersCount: number;
      engagementRate: number;
    },
  ) {
    return this.aiService.getPricingRecommendation(body);
  }
}
