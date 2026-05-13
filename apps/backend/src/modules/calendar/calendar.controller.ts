import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'Unified event calendar: deliverables, payments, appearances, campaigns' })
  @ApiQuery({ name: 'start', required: false, description: 'ISO 8601 start date', example: '2025-01-01' })
  @ApiQuery({ name: 'end', required: false, description: 'ISO 8601 end date', example: '2025-01-31' })
  getCalendar(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return this.svc.getCalendar(userId, role, startDate, endDate);
  }
}
