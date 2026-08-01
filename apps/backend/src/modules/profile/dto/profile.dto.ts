import {
  IsString, IsOptional, IsArray, IsEnum, IsUrl, IsInt, IsBoolean, Min, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialPlatform } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Short bio / about' })
  @IsOptional() @IsString() @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ type: [String], description: 'Content niches (fashion, fitness, ...)' })
  @IsOptional() @IsArray() @IsString({ each: true })
  niche?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Self-described content style (minimalist, luxury, ...)' })
  @IsOptional() @IsArray() @IsString({ each: true })
  contentStyle?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Aesthetic tags' })
  @IsOptional() @IsArray() @IsString({ each: true })
  aestheticTags?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Languages spoken' })
  @IsOptional() @IsArray() @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  city?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  region?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  country?: string;
}

export class AddSocialAccountDto {
  @ApiProperty({ enum: SocialPlatform })
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @ApiProperty({ description: 'Handle / username (without @)' })
  @IsString() @MaxLength(120)
  handle: string;

  @ApiPropertyOptional({ description: 'Public profile URL' })
  @IsOptional() @IsUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Self-reported follower count' })
  @IsOptional() @IsInt() @Min(0)
  followerCount?: number;

  @ApiPropertyOptional({ description: 'Make this the primary account' })
  @IsOptional() @IsBoolean()
  isPrimary?: boolean;
}
