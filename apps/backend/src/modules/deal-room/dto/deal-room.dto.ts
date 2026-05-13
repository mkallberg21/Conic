import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DealRoomMessageType } from '@prisma/client';

export class OpenDealRoomDto {
  @ApiProperty({ description: 'Contract ID to open a deal room for' })
  @IsString()
  contractId: string;
}

export class PostMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Clause type this message references' })
  @IsString()
  @IsOptional()
  clauseRef?: string;

  @ApiPropertyOptional({ enum: DealRoomMessageType })
  @IsEnum(DealRoomMessageType)
  @IsOptional()
  type?: DealRoomMessageType;
}

export class CreateProposalDto {
  @ApiProperty({ description: 'Short title for this proposal' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Array of clause changes: [{ clauseType, original, proposed }]',
    type: 'array',
  })
  @IsArray()
  changes: Array<{ clauseType: string; original: string; proposed: string }>;
}
