import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class UpsertListingDto {
  @IsString()
  headline: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsString()
  sport: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDealTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minDealValueCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  socialFollowersTotal?: number;

  @IsOptional()
  @IsNumber()
  engagementRatePct?: number;

  @IsOptional()
  @IsString()
  audienceAgeRange?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topAudienceLocations?: string[];

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsUrl()
  featuredImageUrl?: string;
}

export class SearchListingsDto {
  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDealValueCents?: number;

  @IsOptional()
  @IsString()
  dealType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
