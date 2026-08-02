import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BrandBillingService } from './brand-billing.service';
import { BrandCheckoutDto } from './dto/brand-billing.dto';

@ApiTags('brand-billing')
@Controller('brand-billing')
export class BrandBillingController {
  constructor(private readonly billing: BrandBillingService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND, UserRole.AGENCY, UserRole.ADMIN)
  @ApiOperation({ summary: 'My brand plan, entitlements and usage' })
  me(@CurrentUser('id') userId: string) {
    return this.billing.getMyPlan(userId);
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Upgrade to a paid brand plan' })
  checkout(@CurrentUser('id') userId: string, @Body() dto: BrandCheckoutDto) {
    return this.billing.startCheckout(userId, dto.plan);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND, UserRole.AGENCY)
  @ApiOperation({ summary: 'Downgrade to Free' })
  cancel(@CurrentUser('id') userId: string) {
    return this.billing.cancel(userId);
  }

  @Post('webhooks')
  @ApiExcludeEndpoint()
  webhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    return this.billing.handleWebhook(headers, Buffer.from(JSON.stringify(body ?? {})));
  }
}
