import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DealLinkService } from './deal-link.service';
import { NilComplianceService } from './nil-compliance.service';
import {
  CreateDealLinkDto,
  CreatePreDisclosureDealLinkDto,
  ContributeDto,
} from './dto/deal-link.dto';
import { CreateDisclosureDto } from './dto/create-disclosure.dto';

// ─── Owner-gated DealLink routes (auth required) ──────────────────────────────

@ApiTags('deal-link')
@ApiBearerAuth()
@Controller('v1/nil')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealLinkController {
  constructor(
    private readonly dealLinkService: DealLinkService,
    private readonly nilService: NilComplianceService,
  ) {}

  // ── Create a DealLink on an existing disclosure ─────────────────────────────

  @Post('disclosures/:disclosureId/deal-link')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a shareable, zero-login DealLink on a disclosure' })
  @ApiBody({ type: CreateDealLinkDto })
  @ApiCreatedResponse({ description: 'Returns the submission URL and link token' })
  async createDealLink(
    @CurrentUser('userId') userId: string,
    @Param('disclosureId') disclosureId: string,
    @Body() dto: CreateDealLinkDto,
  ) {
    return this.dealLinkService.createDealLink(userId, disclosureId, dto);
  }

  // ── Get active DealLink on a disclosure (owner only) ────────────────────────

  @Get('disclosures/:disclosureId/deal-link')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the active DealLink (if any) on a disclosure' })
  async getDealLink(@Param('disclosureId') disclosureId: string) {
    const dealLink = await this.dealLinkService.findActiveByDisclosure(disclosureId);
    if (!dealLink) {
      return { active: false, disclosureId };
    }
    return {
      active: true,
      dealLinkId: dealLink.id,
      contributorType: dealLink.contributorType,
      contributorLabel: dealLink.contributorLabel,
      remainingContributions: dealLink.remainingContributions,
      expiresAt: dealLink.expiresAt,
      acceptedAt: dealLink.acceptedAt,
      submissionUrl: dealLink.submissionUrl,
    };
  }

  // ── Revoke ──────────────────────────────────────────────────────────────────

  @Delete('disclosures/:disclosureId/deal-link')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an active DealLink on a disclosure' })
  async revokeDealLink(@CurrentUser('userId') userId: string, @Param('disclosureId') disclosureId: string) {
    return this.dealLinkService.revokeDealLink(userId, disclosureId);
  }

  // ── Renew ───────────────────────────────────────────────────────────────────

  @Patch('disclosures/:disclosureId/deal-link/renew')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Renew an expiring DealLink (new token, fresh expiry)' })
  @ApiBody({ description: 'Optional expiresInHours to override the default 168h' })
  async renewDealLink(
    @CurrentUser('userId') userId: string,
    @Param('disclosureId') disclosureId: string,
    @Body() body: { expiresInHours?: number },
  ) {
    return this.dealLinkService.renewDealLink(userId, disclosureId, body);
  }

  // ── Pre-disclosure DealLink (creates disclosure on first hit) ───────────────
  //
  // Follow-up to the primary implementation. Requires the schema change documented in
  // deallink-spec.md (DealLink.athleteId + nullable disclosure FK). The endpoint is wired
  // now so the frontend can call it once the backend supports it.

  @Post('disclosures/deal-link/pre')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a DealLink that creates the disclosure on first contribution' })
  @ApiBody({ type: CreatePreDisclosureDealLinkDto })
  async createPreDisclosureDealLink(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePreDisclosureDealLinkDto,
  ) {
    return this.dealLinkService.createPreDisclosureDealLink(userId, dto);
  }
}

// ─── No-auth contribution route ─────────────────────────────────────────────────
//
// This controller has NO guards. It is mounted as a separate controller so the
// no-auth route is maximally isolated from the auth-gated routes — a contributor
// with a valid link token can submit without any JWT.
//
// Security model: the only authz is possession of a valid, unexpired, unrevoked
// linkTokenHash. The token is 48 chars of base64url random bytes — brute-force
// preimage attack on SHA-256 is infeasible.

@ApiTags('deal-link-public')
@Controller('v1/deal-link')
export class DealLinkPublicController {
  constructor(private readonly dealLinkService: DealLinkService) {}

  // ── Resolve a link token to the disclosure state (no auth) ──────────────────

  @Get(':linkToken')
  @ApiOperation({ summary: 'View the disclosure behind a DealLink (no login)' })
  @ApiOkResponse({ description: 'Returns link status + contribution history, no disclosure PII beyond what was submitted' })
  async getByToken(@Param('linkToken') linkToken: string) {
    return this.dealLinkService.getDisclosureByToken(linkToken);
  }

  // ── Contribute (no auth — only link token + expiry + remaining count gate it) ─

  @Post(':linkToken/contribute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Contribute to a DealLink without an account' })
  @ApiBody({ type: ContributeDto })
  @ApiOkResponse({ description: 'Returns the updated disclosure with AI analysis applied' })
  async contribute(
    @Param('linkToken') linkToken: string,
    @Body() dto: ContributeDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.dealLinkService.contribute(linkToken, dto, ip);
  }
}
