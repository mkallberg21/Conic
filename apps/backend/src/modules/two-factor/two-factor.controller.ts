import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TwoFactorService } from './two-factor.service';
import { RequestPhoneDto, VerifyCodeDto } from './dto/two-factor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('two-factor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('two-factor')
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Get('status')
  @ApiOperation({ summary: 'Email/phone verification status for the current user' })
  status(@CurrentUser('id') userId: string) {
    return this.twoFactor.getStatus(userId);
  }

  @Post('email/request')
  @ApiOperation({ summary: 'Send a 6-digit verification code to the account email' })
  requestEmail(@CurrentUser('id') userId: string) {
    return this.twoFactor.requestEmailCode(userId);
  }

  @Post('email/verify')
  @ApiOperation({ summary: 'Verify the email code' })
  verifyEmail(@CurrentUser('id') userId: string, @Body() dto: VerifyCodeDto) {
    return this.twoFactor.verifyEmailCode(userId, dto.code);
  }

  @Post('phone/request')
  @ApiOperation({ summary: 'Set/confirm a phone number and send an SMS code' })
  requestPhone(@CurrentUser('id') userId: string, @Body() dto: RequestPhoneDto) {
    return this.twoFactor.requestPhoneCode(userId, dto.phone);
  }

  @Post('phone/verify')
  @ApiOperation({ summary: 'Verify the phone code' })
  verifyPhone(@CurrentUser('id') userId: string, @Body() dto: VerifyCodeDto) {
    return this.twoFactor.verifyPhoneCode(userId, dto.code);
  }
}
