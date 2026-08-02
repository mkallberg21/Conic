import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { CheckoutDto } from './dto/subscription.dto';

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscription: SubscriptionService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'My current plan (Free / Pro)' })
  me(@CurrentUser('id') userId: string) {
    return this.subscription.getMyPlan(userId);
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Start upgrading to a paid plan' })
  checkout(@CurrentUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.subscription.startCheckout(userId, dto.plan);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ATHLETE)
  @ApiOperation({ summary: 'Cancel and return to Free' })
  cancel(@CurrentUser('id') userId: string) {
    return this.subscription.cancel(userId);
  }

  // Public billing webhook (signature-checked in the service).
  @Post('webhooks')
  @ApiExcludeEndpoint()
  webhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    return this.subscription.handleWebhook(headers, Buffer.from(JSON.stringify(body ?? {})));
  }
}
