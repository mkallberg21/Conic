import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TaxDocumentsService } from './tax-documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestTaxDocumentDto, SubmitTaxDocumentDto } from './dto/tax-documents.dto';

@Controller('tax-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxDocumentsController {
  constructor(private readonly svc: TaxDocumentsService) {}

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Post('request')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER')
  request(@Body() dto: RequestTaxDocumentDto, @CurrentUser('id') userId: string) {
    return this.svc.requestDocument(dto, userId);
  }

  @Get('pending')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER')
  pending() {
    return this.svc.findPendingAdmin();
  }

  @Patch(':id/verify')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER')
  verify(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.verifyDocument(id, userId);
  }

  @Get('summary')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER')
  summary(@Query('year', ParseIntPipe) year: number) {
    return this.svc.getSummaryByYear(year);
  }

  // ─── Athlete / Creator ────────────────────────────────────────────────────

  @Patch(':id/submit')
  @Roles('ATHLETE', 'CREATOR')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitTaxDocumentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.submitDocument(id, dto, userId);
  }

  @Get('mine/athlete/:athleteId')
  @Roles('ATHLETE', 'ADMIN', 'COMPLIANCE_OFFICER')
  forAthlete(@Param('athleteId') athleteId: string) {
    return this.svc.findAllForAthlete(athleteId);
  }

  @Get('mine/creator/:creatorId')
  @Roles('CREATOR', 'ADMIN')
  forCreator(@Param('creatorId') creatorId: string) {
    return this.svc.findAllForCreator(creatorId);
  }
}
