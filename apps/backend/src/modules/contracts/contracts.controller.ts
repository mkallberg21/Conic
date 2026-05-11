import {
  Controller, Get, Post, Body, UseGuards, Version, Param, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
@Version('1')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: 'Create a new contract (Brand only)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.contractsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List contracts for current user' })
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.contractsService.findAll(userId, role);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List available contract templates' })
  async getTemplates() {
    return this.contractsService.getTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract details' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findById(id);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign a contract (brand or creator)' })
  async sign(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress = req.ip ?? '0.0.0.0';
    return this.contractsService.sign(id, userId, role, ipAddress);
  }
}
