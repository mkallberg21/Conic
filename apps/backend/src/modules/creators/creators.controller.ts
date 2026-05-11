import {
  Controller, Get, Patch, Body, UseGuards, Version, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreatorsService } from './creators.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('creators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('creators')
@Version('1')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all creators (publicly discoverable)' })
  @ApiQuery({ name: 'niche', required: false })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'minFollowers', required: false, type: Number })
  async findAll(
    @Query('niche') niche?: string,
    @Query('platform') platform?: string,
    @Query('minFollowers') minFollowers?: number,
  ) {
    return this.creatorsService.findAll({ niche, platform, minFollowers });
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Get my creator profile' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.creatorsService.findByUserId(userId);
  }

  @Get('me/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Get creator dashboard statistics' })
  async getStats(@CurrentUser('id') userId: string) {
    const creator = await this.creatorsService.findByUserId(userId);
    return this.creatorsService.getDashboardStats(creator.id);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CREATOR)
  @ApiOperation({ summary: 'Update creator profile' })
  async update(
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateCreatorDto>,
  ) {
    return this.creatorsService.update(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get creator by ID' })
  async findOne(@Param('id') id: string) {
    return this.creatorsService.findById(id);
  }
}
