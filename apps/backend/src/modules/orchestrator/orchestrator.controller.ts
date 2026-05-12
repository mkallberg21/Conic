import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

import { OrchestratorService } from './orchestrator.service';
import { ExecuteTaskDto } from './dto/execute-task.dto';

@ApiTags('ai-orchestrator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  /**
   * POST /api/v1/ai/execute
   *
   * Single entry-point for all AI operations.
   * The orchestrator decides routing, ordering, conflict resolution, and
   * output normalisation — the caller only specifies what they want.
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @Throttle({ standard: { ttl: 60000, limit: 30 } })
  @ApiOperation({
    summary: 'Execute any AI task via the Unified AI Orchestrator',
    description:
      'Routes the task to the correct AI module(s), resolves output conflicts, ' +
      'and returns a single authoritative response conforming to the unified output contract.',
  })
  @ApiBody({ type: ExecuteTaskDto })
  @ApiOkResponse({
    description: 'Unified AI response',
    schema: {
      example: {
        taskId: 'uuid',
        taskType: 'CREATOR_PREDICT',
        status: 'success',
        result: {},
        confidence: 0.81,
        modulesUsed: ['creator-graph-ai', 'performance-prediction-ai'],
        conflicts: [],
        reasoning: 'Task=CREATOR_PREDICT. Dual-model …',
        executionMs: 312,
        timestamp: '2026-05-12T10:00:00.000Z',
      },
    },
  })
  execute(
    @Body() dto: ExecuteTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.orchestratorService.execute({
      taskType: dto.taskType,
      payload: dto.payload,
      context: {
        ...dto.context,
        userId,
      },
    });
  }

  /**
   * GET /api/v1/ai/tasks
   *
   * Returns all registered task types the orchestrator can handle.
   */
  @Get('tasks')
  @ApiOperation({ summary: 'List all supported AI task types' })
  listTaskTypes() {
    return { taskTypes: this.orchestratorService.listTaskTypes() };
  }

  /**
   * GET /api/v1/ai/audit/history
   *
   * Admin-only: paginated decision history ring buffer.
   */
  @Get('audit/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get orchestrator decision history (admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  getHistory(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return { decisions: this.orchestratorService.getAuditHistory(limit) };
  }

  /**
   * GET /api/v1/ai/audit/stats
   *
   * Admin-only: aggregate performance statistics.
   */
  @Get('audit/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get orchestrator performance statistics (admin only)' })
  getStats() {
    return this.orchestratorService.getAuditStats();
  }
}
