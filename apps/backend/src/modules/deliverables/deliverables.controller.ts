import {
  Controller, Get, Post, Body, UseGuards, Version, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DeliverablesService } from './deliverables.service';
import {
  CreateDeliverableDto,
  SubmitDeliverableDto,
  ReviewDeliverableDto,
} from './dto/create-deliverable.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('deliverables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deliverables')
@Version('1')
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a deliverable on a contract' })
  async create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateDeliverableDto,
  ) {
    return this.deliverablesService.create(userId, role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List deliverables for current user' })
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.deliverablesService.findAll(userId, role);
  }

  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Submit a deliverable with proof (Creator only)' })
  async submit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitDeliverableDto,
  ) {
    return this.deliverablesService.submit(id, userId, dto);
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Approve, reject, or request revision (Brand only)' })
  async review(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewDeliverableDto,
  ) {
    return this.deliverablesService.review(id, userId, dto);
  }
}
