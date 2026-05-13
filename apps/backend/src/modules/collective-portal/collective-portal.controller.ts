import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CollectivePortalService } from './collective-portal.service';
import {
  CreateCollectiveDto,
  AddMemberDto,
  RecordDonationDto,
  CreateDistributionDto,
} from './dto/collective-portal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('collectives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collectives')
export class CollectivePortalController {
  constructor(private readonly svc: CollectivePortalService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  @ApiOperation({ summary: 'Create a NIL collective' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCollectiveDto) {
    return this.svc.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all collectives, optionally filtered by university' })
  @ApiQuery({ name: 'universityId', required: false })
  findAll(@Query('universityId') universityId?: string) {
    return this.svc.findAll(universityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get collective details with members' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get financial summary for a collective' })
  summary(@Param('id') id: string) {
    return this.svc.getSummary(id);
  }

  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  @ApiOperation({ summary: 'Add an athlete to the collective' })
  addMember(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.svc.addMember(id, userId, dto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  @ApiOperation({ summary: 'Remove an athlete from the collective' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.removeMember(id, memberId, userId);
  }

  @Post(':id/donations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  @ApiOperation({ summary: 'Record a donation to the collective' })
  recordDonation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RecordDonationDto,
  ) {
    return this.svc.recordDonation(id, userId, dto);
  }

  @Get(':id/donors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  @ApiOperation({ summary: 'List donors for a collective' })
  getDonors(@Param('id') id: string) {
    return this.svc.getDonors(id);
  }

  @Post(':id/distributions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  @ApiOperation({ summary: 'Create a fund distribution to athlete members' })
  createDistribution(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDistributionDto,
  ) {
    return this.svc.createDistribution(id, userId, dto);
  }

  @Get(':id/distributions')
  @ApiOperation({ summary: 'Get distribution history for a collective' })
  getDistributions(@Param('id') id: string) {
    return this.svc.getDistributions(id);
  }
}
