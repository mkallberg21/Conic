import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordViewDto {
  @ApiProperty({ enum: ['creator', 'athlete'] })
  @IsIn(['creator', 'athlete'])
  targetType: 'creator' | 'athlete';

  @ApiProperty()
  @IsString() @MaxLength(40)
  targetId: string;
}

export class SaveProfileDto {
  @ApiProperty({ enum: ['creator', 'athlete'] })
  @IsIn(['creator', 'athlete'])
  targetType: 'creator' | 'athlete';

  @ApiProperty()
  @IsString() @MaxLength(40)
  targetId: string;

  @ApiPropertyOptional({ description: 'Tag the save to a campaign' })
  @IsOptional() @IsString() @MaxLength(40)
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Private note for your team' })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
