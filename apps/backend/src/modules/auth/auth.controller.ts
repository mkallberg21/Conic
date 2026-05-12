import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Version,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 5 register attempts per minute per IP — prevents account enumeration floods
  @Post('register')
  @Throttle({ burst: { ttl: 60000, limit: 5 }, standard: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user (brand, creator, or agency)' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // 10 login attempts per minute per IP — brute-force protection
  @Post('login')
  @Throttle({ burst: { ttl: 60000, limit: 10 }, standard: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 20 refresh calls per minute — prevents token cycling attacks
  @Post('refresh')
  @Throttle({ burst: { ttl: 60000, limit: 20 }, standard: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh tokens' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: unknown) {
    return user;
  }

  @Get('me/actions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get action items requiring attention for current user' })
  async myActions(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.authService.getActions(userId, role);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @SkipThrottle()
  @ApiOperation({ summary: 'Initiate Google OAuth2 flow' })
  googleLogin() {
    // Redirect handled by Passport
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as {
      googleId: string;
      email: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    const result = await this.authService.googleOauthUser(profile);
    // Redirect to frontend with token in query param (short-lived — FE exchanges immediately)
    const frontendUrl = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
    );
  }
}
