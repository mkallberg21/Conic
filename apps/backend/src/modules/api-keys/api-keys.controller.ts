import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiKeysService, API_KEY_SCOPES } from './api-keys.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-keys.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BRAND', 'AGENCY', 'ADMIN')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get('scopes')
  listScopes() {
    return { scopes: API_KEY_SCOPES };
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.svc.findAllForUser(userId);
  }

  @Post()
  create(@Body() dto: CreateApiKeyDto, @CurrentUser('id') userId: string) {
    return this.svc.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.update(id, dto, userId);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.revoke(id, userId);
  }
}
