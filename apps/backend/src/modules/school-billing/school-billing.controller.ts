import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SchoolBillingService } from './school-billing.service';
import { SchoolCheckoutDto } from './dto/school-billing.dto';

const INSTITUTION_ROLES = [
  UserRole.COMPLIANCE_OFFICER,
  UserRole.UNIVERSITY_ADMIN,
  UserRole.ATHLETIC_DIRECTOR,
  UserRole.ADMIN,
] as const;

@ApiTags('school-billing')
@Controller('school-billing')
export class SchoolBillingController {
  constructor(private readonly school: SchoolBillingService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INSTITUTION_ROLES)
  @ApiOperation({ summary: 'The university a compliance officer belongs to (for auto-selection)' })
  me(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.school.myUniversity(userId, role);
  }

  @Get(':universityId/plan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INSTITUTION_ROLES)
  @ApiOperation({ summary: 'Institution plan, entitlements and roster usage' })
  async plan(
    @Param('universityId') universityId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    await this.school.assertAccess(userId, role, universityId);
    return this.school.getPlan(universityId);
  }

  @Get(':universityId/compliance-overview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INSTITUTION_ROLES)
  @ApiOperation({ summary: 'Compliance command-center: athletes, deals, disclosures, flags' })
  async overview(
    @Param('universityId') universityId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    await this.school.assertAccess(userId, role, universityId);
    return this.school.getComplianceOverview(universityId);
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INSTITUTION_ROLES)
  @ApiOperation({ summary: 'Activate or change an institution plan' })
  async checkout(
    @Body() dto: SchoolCheckoutDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    await this.school.assertAccess(userId, role, dto.universityId);
    return this.school.startCheckout(dto.universityId, dto.plan);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INSTITUTION_ROLES)
  @ApiOperation({ summary: 'Cancel an institution plan' })
  async cancel(
    @Query('universityId') universityId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    await this.school.assertAccess(userId, role, universityId);
    return this.school.cancel(universityId);
  }

  @Post('webhooks')
  @ApiExcludeEndpoint()
  webhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    return this.school.handleWebhook(headers, Buffer.from(JSON.stringify(body ?? {})));
  }
}
