import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ImportType } from '@prisma/client';

export class CreateImportJobDto {
  @IsEnum(ImportType)
  type: ImportType;

  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
