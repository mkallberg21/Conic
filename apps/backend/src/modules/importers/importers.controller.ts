import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ImportersService } from './importers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateImportJobDto } from './dto/importers.dto';

@Controller('importers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BRAND', 'AGENCY', 'ADMIN', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR')
export class ImportersController {
  constructor(private readonly svc: ImportersService) {}

  @Post('jobs')
  createJob(@Body() dto: CreateImportJobDto, @CurrentUser('id') userId: string) {
    return this.svc.createJob(dto, userId);
  }

  @Get('jobs')
  listJobs(@CurrentUser('id') userId: string) {
    return this.svc.findAllForUser(userId);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.findOne(id, userId);
  }

  @Post('jobs/:id/process')
  process(
    @Param('id') id: string,
    @Body('csvContent') csvContent: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.processJob(id, csvContent, userId);
  }
}
