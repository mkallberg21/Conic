import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NilMarketplaceService } from './nil-marketplace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpsertListingDto, SearchListingsDto } from './dto/nil-marketplace.dto';

@Controller('nil-marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NilMarketplaceController {
  constructor(private readonly svc: NilMarketplaceService) {}

  // ─── Athlete ──────────────────────────────────────────────────────────────

  @Post('listing')
  @Roles('ATHLETE')
  upsertListing(@Body() dto: UpsertListingDto, @CurrentUser('id') userId: string) {
    return this.svc.upsertListing(dto, userId);
  }

  @Patch('listing/visibility')
  @Roles('ATHLETE')
  toggleVisibility(
    @Body('isVisible') isVisible: boolean,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.toggleVisibility(userId, isVisible);
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  @Get('search')
  @Roles('BRAND', 'AGENCY', 'ADMIN')
  search(@Query() query: SearchListingsDto) {
    return this.svc.search(query);
  }

  @Get('athletes/:athleteId')
  @Roles('BRAND', 'AGENCY', 'ADMIN', 'ATHLETE', 'AGENT')
  getProfile(@Param('athleteId') athleteId: string) {
    return this.svc.getPublicProfile(athleteId);
  }

  @Post('athletes/:athleteId/inquire')
  @Roles('BRAND', 'AGENCY')
  inquire(@Param('athleteId') athleteId: string, @CurrentUser('id') userId: string) {
    return this.svc.recordInquiry(athleteId, userId);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Patch('athletes/:athleteId/verify')
  @Roles('ADMIN')
  verify(@Param('athleteId') athleteId: string, @CurrentUser('id') userId: string) {
    return this.svc.adminVerify(athleteId, userId);
  }
}
