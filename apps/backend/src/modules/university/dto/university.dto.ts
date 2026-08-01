import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEmail,
  IsEnum,
  IsUrl,
  Min,  MaxLength,
  MinLength,
} from 'class-validator';
import { DivisionLevel } from '@prisma/client';

export class CreateUniversityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  shortName: string;

  @IsOptional()
  @IsString()
  ncaaSchoolId?: string;

  @IsEnum(DivisionLevel)
  division: DivisionLevel;

  @IsOptional()
  @IsString()
  conference?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEmail()
  reportingEmail?: string;

  @IsOptional()
  @IsBoolean()
  disclosureRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  disclosureThreshold?: number;

  @IsOptional()
  nilPolicy?: Record<string, unknown>;
}

export class CreateCollectiveDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  universityId?: string;

  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  ein?: string;
}
