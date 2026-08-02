import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { ApplyDto, CreateBriefDto, RespondApplicationDto } from './dto/marketplace.dto';

@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  // ── Brand ──────────────────────────────────────────────────────────────────

  @Post('briefs')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Post an open opportunity' })
  createBrief(@CurrentUser('id') userId: string, @Body() dto: CreateBriefDto) {
    return this.marketplace.createBrief(userId, dto);
  }

  @Get('briefs/mine')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'My posted briefs' })
  myBriefs(@CurrentUser('id') userId: string) {
    return this.marketplace.listMyBriefs(userId);
  }

  @Patch('briefs/:id/close')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Close a brief' })
  closeBrief(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.marketplace.closeBrief(userId, id);
  }

  @Get('briefs/:id/applications')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Applications to a brief' })
  applications(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.marketplace.listApplications(userId, id);
  }

  @Patch('applications/:id/respond')
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Shortlist / accept / decline an applicant' })
  respond(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: RespondApplicationDto) {
    return this.marketplace.respondToApplication(userId, id, dto);
  }

  // ── Creator / athlete ──────────────────────────────────────────────────────

  @Get('briefs')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Browse open opportunities' })
  browse(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.marketplace.browseBriefs(userId, role);
  }

  @Post('briefs/:id/apply')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Apply to an opportunity' })
  apply(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('id') id: string, @Body() dto: ApplyDto) {
    return this.marketplace.apply(userId, role, id, dto);
  }

  @Get('applications/mine')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'My applications' })
  mine(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.marketplace.myApplications(userId, role);
  }

  @Delete('applications/:id')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Withdraw an application' })
  withdraw(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('id') id: string) {
    return this.marketplace.withdraw(userId, role, id);
  }
}
