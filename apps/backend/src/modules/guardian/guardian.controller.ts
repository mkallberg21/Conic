import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GuardianService } from './guardian.service';
import { AcceptInviteDto, RespondApprovalDto } from './dto/guardian.dto';

@ApiTags('guardian')
@ApiBearerAuth()
@Controller('guardian')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GUARDIAN, UserRole.ADMIN)
export class GuardianController {
  constructor(private readonly guardianService: GuardianService) {}

  @Get('minors')
  @ApiOperation({ summary: 'All minors (athletes/creators) linked to this guardian' })
  getLinkedMinors(@CurrentUser('id') userId: string) {
    return this.guardianService.getLinkedMinors(userId);
  }

  @Get('athletes')
  @ApiOperation({ summary: 'Linked athletes (legacy)' })
  getLinkedAthletes(@CurrentUser('id') userId: string) {
    return this.guardianService.getLinkedAthletes(userId);
  }

  @Get('approvals/pending')
  @ApiOperation({ summary: 'Agreements awaiting this guardian’s approval' })
  getPendingApprovals(@CurrentUser('id') userId: string) {
    return this.guardianService.getPendingApprovals(userId);
  }

  @Post('approvals/:id/respond')
  @ApiOperation({ summary: 'Approve or reject an agreement on the minor’s behalf' })
  respond(
    @CurrentUser('id') userId: string,
    @Param('id') approvalId: string,
    @Body() body: RespondApprovalDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.guardianService.respond(userId, approvalId, body.decision, body.notes, ip);
  }

  @Post('accept-invite')
  @ApiOperation({ summary: 'Accept a guardian invite (links the guardian to the minor)' })
  acceptInvite(@CurrentUser('id') userId: string, @Body() body: AcceptInviteDto) {
    return this.guardianService.acceptInvite(userId, body.token);
  }
}
