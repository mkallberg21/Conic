import {
  IsString, IsOptional, IsInt, IsArray, IsNumber, Min, Max, IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMatchRequestDto {
  @ApiProperty({ description: 'Plain-text campaign brief describing the deal' })
  @IsString()
  brief: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Maximum budget per creator in cents' })
  @IsInt()
  @IsOptional()
  budgetCents?: number;

  @ApiPropertyOptional({ example: ['beauty', 'fitness'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetNiche?: string[];

  @ApiPropertyOptional({ example: ['instagram', 'tiktok'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetPlatforms?: string[];

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  targetMinFollowers?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  targetMaxFollowers?: number;

  @ApiPropertyOptional({ description: 'Minimum engagement rate (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  targetMinEngagement?: number;

  @ApiPropertyOptional({ enum: ['creator', 'athlete', 'both'], default: 'creator' })
  @IsEnum(['creator', 'athlete', 'both'])
  @IsOptional()
  targetEntityType?: string;

  @ApiPropertyOptional({ description: 'Sport (for athlete matching)' })
  @IsString()
  @IsOptional()
  targetSport?: string;

  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  maxResults?: number;
}
