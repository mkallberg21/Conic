import {
  IsString, IsOptional, IsArray, IsObject, IsNumber, Min, Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCreatorDto {
  @ApiProperty()
  @IsString()
  handle: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  platforms?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryPlatform?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  niche?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  followersCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  engagementRate?: number;
}
