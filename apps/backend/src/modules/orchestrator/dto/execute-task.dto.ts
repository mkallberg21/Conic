import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskType } from '../types/orchestrator.types';

export const VALID_TASK_TYPES: TaskType[] = [
  'CONTRACT_GENERATE',
  'CONTRACT_RISK',
  'DELIVERABLE_VERIFY',
  'PRICING_RECOMMEND',
  'CREATOR_PREDICT',
  'CREATOR_INTELLIGENCE',
  'CAMPAIGN_TIMELINE',
  'CAMPAIGN_DEBRIEF',
  'CAMPAIGN_INTELLIGENCE',
  'CREATOR_ROSTER',
  'CONTRACT_INTELLIGENCE',
];

class ExecuteContextDto {
  @ApiPropertyOptional({ description: 'Client session identifier for cross-call context' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for distributed tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({ enum: ['high', 'normal', 'low'], default: 'normal' })
  @IsOptional()
  @IsString()
  priority?: 'high' | 'normal' | 'low';
}

export class ExecuteTaskDto {
  @ApiProperty({
    enum: VALID_TASK_TYPES,
    description: 'The AI task type to execute',
    example: 'CREATOR_PREDICT',
  })
  @IsEnum(VALID_TASK_TYPES)
  taskType: TaskType;

  @ApiProperty({
    description: 'Task-specific input payload (see each task type for schema)',
    example: { creatorId: 'cuid-xxx', followers: 50000, engagementRate: 4.2 },
  })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Optional request context for session tracking' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ExecuteContextDto)
  context?: ExecuteContextDto;
}
