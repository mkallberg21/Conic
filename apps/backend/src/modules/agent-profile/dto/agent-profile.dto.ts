import {
  IsString,
  IsOptional,
  IsUrl,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsBoolean,
  IsDateString,} from 'class-validator';

export class UpdateAgentProfileDto {
  @IsOptional()
  @IsString()
  agencyName?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  licenseState?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

export class CreateRepresentationDto {
  @IsString()
  athleteId: string;

  @IsArray()
  @IsString({ each: true })
  scope: string[]; // nil_deals, appearances, social_media, full_representation

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsOptional()
  @IsUrl()
  contractUrl?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateRepresentationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scope?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsOptional()
  @IsUrl()
  contractUrl?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
