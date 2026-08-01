import { IsString, IsOptional, IsIn, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscoverySearchDto {
  @ApiProperty({ description: 'Natural-language description of who you want to work with' })
  @IsString() @MaxLength(1000)
  query: string;

  @ApiPropertyOptional({ enum: ['creator', 'athlete', 'both'], description: 'Restrict to creators, athletes, or both' })
  @IsOptional() @IsIn(['creator', 'athlete', 'both'])
  entityType?: 'creator' | 'athlete' | 'both';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  page?: number;
}
