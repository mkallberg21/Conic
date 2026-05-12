import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NilComplianceService } from './nil-compliance.service';
import { CreateDisclosureDto } from './dto/create-disclosure.dto';
import { CreateNilDealDto, CreateAppearanceDto, ReviewDisclosureDto } from './dto/nil-deal.dto';

@Controller('v1/nil')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NilComplianceController {
  constructor(private readonly nilService: NilComplianceService) {}

  // ─── Disclosures ────────────────────────────────────────────────────────────

  @Post('disclosures')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.ADMIN)
  createDisclosure(@CurrentUser() user: { userId: string }, @Body() dto: CreateDisclosureDto) {
    return this.nilService.createDisclosure(user.userId, dto);
  }

  @Get('disclosures')
  @Roles(UserRole.ATHLETE, UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN)
  getDisclosures(
    @CurrentUser() user: { userId: string; role: UserRole },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
  ) {
    return this.nilService.getDisclosures(user.userId, user.role, page, take);
  }

  @Post('disclosures/review')
  @Roles(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  reviewDisclosure(
    @CurrentUser() user: { userId: string },
    @Body() dto: ReviewDisclosureDto,
  ) {
    return this.nilService.reviewDisclosure(user.userId, dto);
  }

  // ─── NIL Deals ──────────────────────────────────────────────────────────────

  @Post('deals')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.ADMIN)
  createNilDeal(@CurrentUser() user: { userId: string }, @Body() dto: CreateNilDealDto) {
    return this.nilService.createNilDeal(user.userId, dto);
  }

  @Get('deals')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN)
  getNilDeals(
    @CurrentUser() user: { userId: string; role: UserRole },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
  ) {
    return this.nilService.getNilDeals(user.userId, user.role, page, take);
  }

  // ─── Appearances ────────────────────────────────────────────────────────────

  @Post('appearances')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.ADMIN)
  createAppearance(@CurrentUser() user: { userId: string }, @Body() dto: CreateAppearanceDto) {
    return this.nilService.createAppearance(user.userId, dto);
  }

  // ─── FMV ────────────────────────────────────────────────────────────────────

  @Post('fmv/assess')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.ADMIN)
  requestFmv(
    @CurrentUser() user: { userId: string },
    @Body() body: { athleteId: string; dealType: string; platform?: string },
  ) {
    return this.nilService.requestFmvAssessment(user.userId, body.athleteId, body.dealType, body.platform);
  }

  // ─── Eligibility ────────────────────────────────────────────────────────────

  @Get('eligibility/:athleteId')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN)
  checkEligibility(
    @CurrentUser() user: { userId: string; role: UserRole },
    @Param('athleteId') athleteId: string,
  ) {
    return this.nilService.checkEligibility(user.userId, user.role, athleteId);
  }

  // ─── Compliance Reports ─────────────────────────────────────────────────────

  @Post('reports/generate')
  @Roles(UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  generateReport(
    @CurrentUser() user: { userId: string },
    @Body() body: { universityId: string; reportType: string; period: string },
  ) {
    return this.nilService.generateComplianceReport(
      user.userId,
      body.universityId,
      body.reportType,
      body.period,
    );
  }

  @Get('reports')
  @Roles(UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ATHLETIC_DIRECTOR, UserRole.ADMIN)
  getReports(
    @Query('universityId') universityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
  ) {
    return this.nilService.getComplianceReports(universityId, page, take);
  }
}
