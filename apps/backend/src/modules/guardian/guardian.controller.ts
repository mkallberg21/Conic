import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GuardianService } from './guardian.service';

@Controller('v1/guardian')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GUARDIAN, UserRole.ADMIN)
export class GuardianController {
  constructor(private readonly guardianService: GuardianService) {}

  @Get('athletes')
  getLinkedAthletes(@CurrentUser() user: { userId: string }) {
    return this.guardianService.getLinkedAthletes(user.userId);
  }

  @Get('approvals/pending')
  getPendingApprovals(@CurrentUser() user: { userId: string }) {
    return this.guardianService.getPendingApprovals(user.userId);
  }

  @Post('approvals/:id/respond')
  respond(
    @CurrentUser() user: { userId: string },
    @Param('id') approvalId: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; notes?: string },
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.guardianService.respond(user.userId, approvalId, body.decision, body.notes, ip);
  }
}
