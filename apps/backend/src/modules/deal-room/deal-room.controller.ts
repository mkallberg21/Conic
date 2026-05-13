import {
  Controller, Get, Post, Body, Param, UseGuards, Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DealRoomService } from './deal-room.service';
import { OpenDealRoomDto, PostMessageDto, CreateProposalDto } from './dto/deal-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('deal-room')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deal-room')
export class DealRoomController {
  constructor(private readonly svc: DealRoomService) {}

  @Post('open')
  @ApiOperation({ summary: 'Open a deal room for a contract' })
  open(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: OpenDealRoomDto,
  ) {
    return this.svc.openRoom(userId, role, dto);
  }

  @Get(':contractId')
  @ApiOperation({ summary: 'Get deal room with all messages and proposals' })
  getRoom(
    @Param('contractId') contractId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.getRoom(contractId, userId, role);
  }

  @Post(':contractId/messages')
  @ApiOperation({ summary: 'Post a message to the deal room' })
  postMessage(
    @Param('contractId') contractId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: PostMessageDto,
  ) {
    return this.svc.postMessage(contractId, userId, role, dto);
  }

  @Post(':contractId/proposals')
  @ApiOperation({ summary: 'Submit a contract change proposal' })
  createProposal(
    @Param('contractId') contractId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateProposalDto,
  ) {
    return this.svc.createProposal(contractId, userId, role, dto);
  }

  @Patch(':contractId/proposals/:proposalId/accept')
  @ApiOperation({ summary: 'Accept a proposal' })
  accept(
    @Param('contractId') contractId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.resolveProposal(contractId, proposalId, userId, role, 'accept');
  }

  @Patch(':contractId/proposals/:proposalId/reject')
  @ApiOperation({ summary: 'Reject a proposal' })
  reject(
    @Param('contractId') contractId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.resolveProposal(contractId, proposalId, userId, role, 'reject');
  }

  @Patch(':contractId/proposals/:proposalId/counter')
  @ApiOperation({ summary: 'Mark a proposal as countered (then submit new proposal)' })
  counter(
    @Param('contractId') contractId: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.resolveProposal(contractId, proposalId, userId, role, 'counter');
  }

  @Patch(':contractId/agree')
  @ApiOperation({ summary: 'Mark deal room as agreed — proceed to signing' })
  agree(
    @Param('contractId') contractId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.closeRoom(contractId, userId, role, true);
  }

  @Patch(':contractId/close')
  @ApiOperation({ summary: 'Close deal room without agreement' })
  close(
    @Param('contractId') contractId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.svc.closeRoom(contractId, userId, role, false);
  }
}
