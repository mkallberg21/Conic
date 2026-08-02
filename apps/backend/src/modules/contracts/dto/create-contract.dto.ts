import {
  IsString, IsOptional, IsArray, IsBoolean, IsNumber,
  IsDateString, Min, ValidateNested, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DealSource } from '@prisma/client';

export class MilestoneDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Amount in cents' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty()
  @IsNumber()
  position: number;
}

export class CreateContractDto {
  @ApiProperty()
  @IsString()
  creatorId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ required: false, enum: DealSource, description: 'How the deal was sourced (drives the brand-side fee rate)' })
  @IsOptional()
  @IsEnum(DealSource)
  dealSource?: DealSource;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  usageRights?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  exclusivity?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  exclusivityDays?: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Total value in cents' })
  @IsNumber()
  @Min(0)
  totalValue: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false, type: [MilestoneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones?: MilestoneDto[];
}
