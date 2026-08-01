import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AntiCircumventionService } from './anti-circumvention.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('anti-circumvention')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('anti-circumvention')
export class AntiCircumventionController {
  constructor(private readonly service: AntiCircumventionService) {}

  @Get('clause')
  @ApiOperation({ summary: 'The standard non-circumvention clause embedded in contracts' })
  clause() {
    return this.service.standardClause();
  }

  @Get('report')
  @Roles(UserRole.BRAND, UserRole.AGENCY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Circumvention flags (off-platform contact attempts)' })
  report(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.service.getReport(userId, role);
  }
}
