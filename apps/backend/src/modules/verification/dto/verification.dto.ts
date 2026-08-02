import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AgeCheckMethod, KybTier } from '@prisma/client';

export class StartAgeCheckDto {
  @ApiProperty({ enum: AgeCheckMethod, description: 'ESTIMATION (signup gate) or DOCUMENT (payout / adult grade)' })
  @IsEnum(AgeCheckMethod)
  method: AgeCheckMethod;
}

export class StartKybDto {
  @ApiProperty({ example: 'Acme Brands, Inc.' })
  @IsString() @MaxLength(200)
  legalName: string;

  @ApiProperty({ example: 'US' })
  @IsString() @Length(2, 2)
  country: string;

  @ApiProperty({ enum: KybTier, description: 'BASIC (contact adults) or ENHANCED (contact minors)' })
  @IsEnum(KybTier)
  tier: KybTier;

  @ApiPropertyOptional({ description: 'Business registration / EIN number' })
  @IsOptional() @IsString() @MaxLength(80)
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Primary web domain' })
  @IsOptional() @IsString() @MaxLength(200)
  domain?: string;

  @ApiPropertyOptional({ description: 'Required true for ENHANCED (minor-contact) tier' })
  @IsOptional() @IsBoolean()
  youthSafetyAccepted?: boolean;
}
