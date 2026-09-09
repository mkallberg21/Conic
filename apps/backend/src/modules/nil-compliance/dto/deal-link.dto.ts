import { IsString, IsInt, IsOptional, IsDateString, IsEnum, Min, MaxLength } from 'class-validator';

// ─── Contributor type (no-auth submitter label) ────────────────────────────────

export enum ContributorType {
  BRAND = 'BRAND',
  AGENT = 'AGENT',
  GUARDIAN = 'GUARDIAN',
  BUSINESS = 'BUSINESS',
  ATHLETE = 'ATHLETE',
}

// ─── Create a DealLink on an existing disclosure ───────────────────────────────

export class CreateDealLinkDto {
  @IsEnum(ContributorType)
  contributorType: ContributorType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contributorLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @MaxLength(10)
  maxContributions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @MaxLength(10)
  expiresInHours?: number;
}

// ─── Contribute to a DealLink (no-auth endpoint) ───────────────────────────────

export class ContributeDto {
  @IsEnum(DealTypeEnum)
  dealType: DealTypeEnum;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  brandName: string;

  @IsInt()
  @Min(0)
  dealValueCents: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  contributorNotes?: string;
}

// ─── Create a pre-disclosure DealLink (link creates disclosure on first hit) ───

export class CreatePreDisclosureDealLinkDto {
  @IsString()
  @MinLength(1)
  athleteId: string;

  @IsOptional()
  @IsString()
  universityId?: string;

  @IsEnum(ContributorType)
  contributorType: ContributorType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contributorLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxContributions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;
}

// ─── Shared enum ────────────────────────────────────────────────────────────────

export { DealTypeEnum } from './create-disclosure.dto';
