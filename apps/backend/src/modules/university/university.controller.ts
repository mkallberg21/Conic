import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UniversityService } from './university.service';
import { CreateUniversityDto, CreateCollectiveDto } from './dto/university.dto';

@Controller('v1/universities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UniversityController {
  constructor(private readonly universityService: UniversityService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateUniversityDto) {
    return this.universityService.create(user.userId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRAND, UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('state') state?: string,
    @Query('division') division?: string,
  ) {
    return this.universityService.findAll(page, take, state, division);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BRAND, UserRole.ATHLETE, UserRole.AGENT, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ATHLETIC_DIRECTOR)
  findById(@Param('id') id: string) {
    return this.universityService.findById(id);
  }

  @Get(':id/athletes')
  @Roles(UserRole.ADMIN, UserRole.BRAND, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ATHLETIC_DIRECTOR)
  getAthleteRoster(
    @Param('id') id: string,
    @Query('sport') sport?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number = 50,
  ) {
    return this.universityService.getAthleteRoster(id, sport, page, take);
  }

  @Get(':id/dashboard')
  @Roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.UNIVERSITY_ADMIN, UserRole.ATHLETIC_DIRECTOR)
  getDashboard(@Param('id') id: string) {
    return this.universityService.getDashboardStats(id);
  }

  // ─── Collectives ────────────────────────────────────────────────────────────

  @Post('collectives')
  @Roles(UserRole.ADMIN, UserRole.COLLECTIVE_ADMIN)
  createCollective(@CurrentUser() user: { userId: string }, @Body() dto: CreateCollectiveDto) {
    return this.universityService.createCollective(user.userId, dto);
  }

  @Get('collectives/list')
  findCollectives(
    @Query('universityId') universityId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number = 50,
  ) {
    return this.universityService.findCollectives(universityId, page, take);
  }
}
