import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Version,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BRAND)
@Controller('webhooks')
@Version('1')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  async create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all webhook endpoints' })
  async findAll() {
    return this.webhooksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook endpoint details + recent deliveries' })
  async findOne(@Param('id') id: string) {
    return this.webhooksService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  async update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  async remove(@Param('id') id: string) {
    return this.webhooksService.delete(id);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rotate webhook signing secret' })
  async rotateSecret(@Param('id') id: string) {
    return this.webhooksService.rotateSecret(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get delivery statistics for a webhook endpoint' })
  async stats(@Param('id') id: string) {
    return this.webhooksService.getDeliveryStats(id);
  }
}
