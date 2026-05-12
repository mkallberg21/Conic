import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisputeContractDto {
  @ApiProperty({ example: 'Creator failed to include required hashtags', maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
