import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgentProfileService } from './agent-profile.service';
import {
  UpdateAgentProfileDto,
  CreateRepresentationDto,
  UpdateRepresentationDto,
} from './dto/agent-profile.dto';

@Controller('v1/agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentProfileController {
  constructor(private readonly agentService: AgentProfileService) {}

  // ─── Own Profile ─────────────────────────────────────────────────────────

  @Get('me')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  getMyProfile(@CurrentUser() user: { userId: string }) {
    return this.agentService.getProfile(user.userId);
  }

  @Patch('me')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  updateMyProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateAgentProfileDto,
  ) {
    return this.agentService.upsertProfile(user.userId, dto);
  }

  // ─── Admin: list & verify ─────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRAND)
  listAgents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('verifiedOnly', new DefaultValuePipe(false), ParseBoolPipe) verifiedOnly: boolean,
  ) {
    return this.agentService.listAgents(page, limit, verifiedOnly);
  }

  @Post(':userId/verify')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  verifyAgent(
    @Param('userId') agentUserId: string,
    @CurrentUser() admin: { userId: string },
  ) {
    return this.agentService.verifyAgent(agentUserId, admin.userId);
  }

  // ─── Representations ─────────────────────────────────────────────────────

  @Get('me/representations')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  getRepresentations(
    @CurrentUser() user: { userId: string },
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ) {
    return this.agentService.getRepresentations(user.userId, includeInactive);
  }

  @Post('me/representations')
  @Roles(UserRole.AGENT)
  addRepresentation(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateRepresentationDto,
  ) {
    return this.agentService.addRepresentation(user.userId, dto);
  }

  @Patch('me/representations/:repId')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  updateRepresentation(
    @CurrentUser() user: { userId: string },
    @Param('repId') repId: string,
    @Body() dto: UpdateRepresentationDto,
  ) {
    return this.agentService.updateRepresentation(user.userId, repId, dto);
  }

  @Delete('me/representations/:repId')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  terminateRepresentation(
    @CurrentUser() user: { userId: string },
    @Param('repId') repId: string,
  ) {
    return this.agentService.terminateRepresentation(user.userId, repId);
  }
}
