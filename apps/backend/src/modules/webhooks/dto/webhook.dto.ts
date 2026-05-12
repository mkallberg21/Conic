import { IsString, IsUrl, IsArray, ArrayNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ description: 'HTTPS URL to deliver events to' })
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  url: string;

  @ApiProperty({
    description: 'Events to subscribe to',
    example: ['contract.created', 'payment.released'],
    enum: [
      'contract.created', 'contract.signed', 'contract.activated', 'contract.disputed',
      'deliverable.submitted', 'deliverable.approved', 'deliverable.rejected',
      'payment.released', 'payment.failed',
      'campaign.summary_generated',
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({ description: 'Optional description for this endpoint' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
