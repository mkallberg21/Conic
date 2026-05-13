import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MatchmakingService } from './matchmaking.service';
import { CreateMatchRequestDto } from './dto/matchmaking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('matchmaking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly svc: MatchmakingService) {}

  @Post('requests')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND, UserRole.AGENCY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Submit a campaign brief — AI returns ranked creator/athlete matches' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMatchRequestDto,
  ) {
    return this.svc.createRequest(userId, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List your match requests' })
  list(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.listRequests(userId, role);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get match request with ranked results' })
  get(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.getRequest(id, userId, role);
  }
}
