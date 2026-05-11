import {
  IsString, IsOptional, IsArray, IsDateString, IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliverableDto {
  @ApiProperty()
  @IsString()
  contractId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'instagram' })
  @IsString()
  platform: string;

  @ApiProperty({ example: 'reel' })
  @IsString()
  contentType: string;

  @ApiProperty()
  @IsDateString()
  dueDate: string;
}

export class SubmitDeliverableDto {
  @ApiProperty()
  @IsUrl()
  proofUrl: string;

  @ApiProperty({ example: 'url' })
  @IsString()
  proofType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  mentions?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  postUrl?: string;
}

export class ReviewDeliverableDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'] })
  @IsString()
  action: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
