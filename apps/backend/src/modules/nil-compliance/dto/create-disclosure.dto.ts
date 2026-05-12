import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum DealTypeEnum {
  ENDORSEMENT = 'endorsement',
  APPEARANCE = 'appearance',
  SOCIAL_POST = 'social_post',
  LICENSING = 'licensing',
  CAMP_CLINIC = 'camp_clinic',
  OTHER = 'other',
}

export class CreateDisclosureDto {
  @IsString()
  athleteId: string;

  @IsOptional()
  @IsString()
  universityId?: string;

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
  contractUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportingDocUrls?: string[];
}
