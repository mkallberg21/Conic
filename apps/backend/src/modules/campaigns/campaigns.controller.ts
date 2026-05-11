import { Controller, Get, Post, Body, Param, UseGuards, Version } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BRAND, UserRole.ADMIN)
@Controller('campaigns')
@Version('1')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign with AI-generated timeline' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns for my brand' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.campaignsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details with tasks and summaries' })
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Post(':id/debrief')
  @ApiOperation({ summary: 'Generate AI campaign debrief and PDF summary' })
  async debrief(@Param('id') id: string) {
    return this.campaignsService.generateDebrief(id);
  }
}
