import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { TaxDocumentType } from '@prisma/client';

export class RequestTaxDocumentDto {
  @IsEnum(TaxDocumentType)
  type: TaxDocumentType;

  @IsInt()
  @Min(2020)
  @Max(2100)
  taxYear: number;

  @IsOptional()
  @IsString()
  athleteId?: string;

  @IsOptional()
  @IsString()
  creatorId?: string;
}

export class SubmitTaxDocumentDto {
  @IsUrl()
  documentUrl: string;

  @IsOptional()
  @IsString()
  ssn_last4?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;
}
