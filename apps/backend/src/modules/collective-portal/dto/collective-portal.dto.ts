import {
  IsString, IsOptional, IsEmail, IsBoolean, IsInt, IsNumber,
  Min, Max, MaxLength, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCollectiveDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  slug: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  universityId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sport?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ein?: string;
}

export class AddMemberDto {
  @ApiProperty()
  @IsString()
  athleteId: string;

  @ApiPropertyOptional({ description: 'Distribution share percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sharePercent?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordDonationDto {
  @ApiProperty({ description: 'Donor display name' })
  @IsString()
  displayName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Amount in cents' })
  @IsInt()
  @Min(100)
  amountCents: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

export class CreateDistributionDto {
  @ApiProperty({ description: 'IDs of members to include in this distribution' })
  @IsArray()
  @IsString({ each: true })
  memberIds: string[];

  @ApiProperty({ description: 'Total amount to distribute (cents)' })
  @IsInt()
  @Min(100)
  totalAmountCents: number;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsString()
  periodStart: string;

  @ApiProperty({ example: '2025-03-31' })
  @IsString()
  periodEnd: string;

  @ApiProperty({ example: 2025 })
  @IsInt()
  taxYear: number;
}
