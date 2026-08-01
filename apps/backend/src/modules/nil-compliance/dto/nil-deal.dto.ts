import {
  IsString,
  IsInt,
  IsOptional,  IsDateString,
  IsEnum,
  IsBoolean,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DealTypeEnum } from './create-disclosure.dto';
import { AppearanceType } from '@prisma/client';

export class CreateNilDealDto {
  @IsString()
  athleteId: string;

  @IsOptional()
  @IsString()
  collectiveId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsEnum(DealTypeEnum)
  dealType: DealTypeEnum;

  @IsInt()
  @Min(1)
  valueCents: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  disclosureId?: string;
}

export class CreateAppearanceDto {
  @IsString()
  athleteId: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  nilDealId?: string;

  @IsEnum(AppearanceType)
  type: AppearanceType;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  venueAddress?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsInt()
  @Min(0)
  compensationCents: number;

  @IsOptional()
  @IsBoolean()
  travelIncluded?: boolean;

  @IsOptional()
  travelDetails?: Record<string, unknown>;
}

export class ReviewDisclosureDto {
  @IsString()
  disclosureId: string;

  @IsEnum(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
