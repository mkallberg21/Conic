import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CreatorPlan } from '@prisma/client';

export class CheckoutDto {
  @ApiProperty({ enum: CreatorPlan, description: 'Plan to subscribe to' })
  @IsEnum(CreatorPlan)
  plan: CreatorPlan;
}
