import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgeVerificationService } from './age-verification.service';
import { BusinessVerificationService } from './business-verification.service';
import { StartAgeCheckDto, StartKybDto } from './dto/verification.dto';

@ApiTags('verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly age: AgeVerificationService,
    private readonly kyb: BusinessVerificationService,
  ) {}

  // ── Age (creators / athletes) ──────────────────────────────────────────────

  @Get('age/status')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Age-verification status for the current user' })
  ageStatus(@CurrentUser('id') userId: string) {
    return this.age.getStatus(userId);
  }

  @Post('age/start')
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Start an age check (estimation or document)' })
  ageStart(@CurrentUser('id') userId: string, @Body() dto: StartAgeCheckDto) {
    return this.age.start(userId, dto.method);
  }

  // ── Business KYB (brands) ──────────────────────────────────────────────────

  @Get('business/status')
  @Roles(UserRole.BRAND, UserRole.ADMIN)
  @ApiOperation({ summary: 'Business (KYB) tier + status for the current brand' })
  kybStatus(@CurrentUser('id') userId: string) {
    return this.kyb.getStatus(userId);
  }

  @Post('business/start')
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Start business verification at a tier (BASIC or ENHANCED)' })
  kybStart(@CurrentUser('id') userId: string, @Body() dto: StartKybDto) {
    return this.kyb.start(userId, dto);
  }
}
