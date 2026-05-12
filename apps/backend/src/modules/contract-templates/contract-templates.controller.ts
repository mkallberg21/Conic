import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContractTemplatesService } from './contract-templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
  TemplateQueryDto,
} from './dto/contract-templates.dto';

@Controller('contract-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractTemplatesController {
  constructor(private readonly svc: ContractTemplatesService) {}

  @Post()
  @Roles('BRAND', 'AGENCY', 'ADMIN')
  create(@Body() dto: CreateContractTemplateDto, @CurrentUser('id') userId: string) {
    return this.svc.create(dto, userId);
  }

  @Get()
  @Roles('BRAND', 'CREATOR', 'AGENCY', 'ADMIN', 'ATHLETE', 'AGENT')
  findAll(@Query() query: TemplateQueryDto, @CurrentUser('id') userId: string) {
    return this.svc.findAll(query, userId);
  }

  @Get(':id')
  @Roles('BRAND', 'CREATOR', 'AGENCY', 'ADMIN', 'ATHLETE', 'AGENT')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.findOne(id, userId);
  }

  @Patch(':id')
  @Roles('BRAND', 'AGENCY', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractTemplateDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles('BRAND', 'AGENCY', 'ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.svc.remove(id, userId, role === 'ADMIN');
  }

  @Post(':id/use')
  @Roles('BRAND', 'CREATOR', 'AGENCY', 'ADMIN', 'ATHLETE', 'AGENT')
  use(@Param('id') id: string) {
    return this.svc.useTemplate(id);
  }

  @Post(':id/ai-suggestions')
  @Roles('BRAND', 'AGENCY', 'ADMIN', 'AGENT')
  aiSuggestions(@Param('id') id: string, @Body('context') context: string) {
    return this.svc.generateAiSuggestions(id, context);
  }
}
