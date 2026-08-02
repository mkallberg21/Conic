import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EngagementService } from './engagement.service';
import { RecordViewDto, SaveProfileDto } from './dto/engagement.dto';

@ApiTags('engagement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  // ── Creator / athlete insights ─────────────────────────────────────────────

  @Get('insights')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'My profile-view and saved-by-brand insights (counts — free)' })
  insights(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.engagement.getMyInsights(userId, role);
  }

  @Get('viewers')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Which brands viewed/saved me (Pro only)' })
  viewers(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.engagement.getMyViewers(userId, role);
  }

  // ── Brand: views + saved shortlist ─────────────────────────────────────────

  @Post('view')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Record that this brand viewed a profile (deduped daily)' })
  recordView(@CurrentUser('id') userId: string, @Body() dto: RecordViewDto) {
    return this.engagement.recordView(userId, dto.targetType, dto.targetId);
  }

  @Get('saved')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'List saved profiles, optionally by campaign' })
  listSaved(@CurrentUser('id') userId: string, @Query('campaignId') campaignId?: string) {
    return this.engagement.listSaved(userId, campaignId);
  }

  @Get('saved/check')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Whether a profile is already saved' })
  isSaved(
    @CurrentUser('id') userId: string,
    @Query('targetType') targetType: 'creator' | 'athlete',
    @Query('targetId') targetId: string,
  ) {
    return this.engagement.isSaved(userId, targetType, targetId);
  }

  @Post('saved')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Save a profile to the shortlist' })
  save(@CurrentUser('id') userId: string, @Body() dto: SaveProfileDto) {
    return this.engagement.saveProfile(userId, dto);
  }

  @Delete('saved')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Remove a profile from the shortlist' })
  unsave(
    @CurrentUser('id') userId: string,
    @Query('targetType') targetType: 'creator' | 'athlete',
    @Query('targetId') targetId: string,
  ) {
    return this.engagement.unsaveProfile(userId, targetType, targetId);
  }
}
