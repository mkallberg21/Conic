import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BrandPlan } from '@prisma/client';

export class BrandCheckoutDto {
  @ApiProperty({ enum: BrandPlan })
  @IsEnum(BrandPlan)
  plan: BrandPlan;
}
