import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProfileService } from './profile.service';
import { AddSocialAccountDto, UpdateProfileDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CREATOR, UserRole.ATHLETE)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile + linked social accounts' })
  getMyProfile(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.profileService.getMyProfile(userId, role);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile attributes (bio, niche, style, location)' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, role, dto);
  }

  @Get('social')
  @ApiOperation({ summary: 'List linked social accounts' })
  listSocial(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.profileService.listSocialAccounts(userId, role);
  }

  @Post('social')
  @ApiOperation({ summary: 'Link a social account' })
  addSocial(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: AddSocialAccountDto,
  ) {
    return this.profileService.addSocialAccount(userId, role, dto);
  }

  @Delete('social/:id')
  @ApiOperation({ summary: 'Unlink a social account' })
  removeSocial(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.profileService.removeSocialAccount(userId, role, id);
  }

  @Patch('social/:id/primary')
  @ApiOperation({ summary: 'Set a social account as primary' })
  setPrimary(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.profileService.setPrimary(userId, role, id);
  }

  @Post('social/:id/verify')
  @ApiOperation({ summary: 'Begin ownership verification for a social account' })
  requestVerification(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.profileService.requestVerification(userId, role, id);
  }

  @Post('social/:id/confirm')
  @ApiOperation({ summary: 'Confirm ownership verification (checks the posted code)' })
  confirmVerification(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.profileService.confirmVerification(userId, role, id);
  }
}
