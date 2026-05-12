import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Items per page (max 100)' })
  async findAll(
    @Query('page') page = 1,
    @Query('take') take = 25,
  ) {
    return this.usersService.findAll(Number(page), Number(take));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a user (Admin only)' })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a previously deactivated user (Admin only)' })
  async reactivate(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }
}
