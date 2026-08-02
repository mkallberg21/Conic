import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { InstitutionPlan } from '@prisma/client';

export class SchoolCheckoutDto {
  @ApiProperty()
  @IsString()
  universityId: string;

  @ApiProperty({ enum: InstitutionPlan })
  @IsEnum(InstitutionPlan)
  plan: InstitutionPlan;
}
