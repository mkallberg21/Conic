import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBriefDto {
  @ApiProperty() @IsString() @MaxLength(160)
  title: string;

  @ApiProperty() @IsString() @MaxLength(4000)
  description: string;

  @ApiProperty({ description: 'Budget in cents' }) @IsInt() @Min(0)
  budgetCents: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
  deliverableType?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  platforms?: string[];

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  niche?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  sport?: string;

  @ApiPropertyOptional({ enum: ['creator', 'athlete', 'both'] })
  @IsOptional() @IsIn(['creator', 'athlete', 'both'])
  targetType?: 'creator' | 'athlete' | 'both';

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  minFollowers?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString()
  deadline?: string;
}

export class ApplyDto {
  @ApiProperty({ description: 'Why you’re a fit' }) @IsString() @MaxLength(2000)
  pitch: string;

  @ApiPropertyOptional({ description: 'Your rate in cents' }) @IsOptional() @IsInt() @Min(0)
  proposedRateCents?: number;
}

export class RespondApplicationDto {
  @ApiProperty({ enum: ['SHORTLISTED', 'ACCEPTED', 'DECLINED'] })
  @IsIn(['SHORTLISTED', 'ACCEPTED', 'DECLINED'])
  decision: 'SHORTLISTED' | 'ACCEPTED' | 'DECLINED';
}
