import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class RequestPhoneDto {
  @ApiProperty({ example: '+14155550123', description: 'Phone number in international (E.164) format' })
  @IsString()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, { message: 'Enter a valid phone number' })
  phone: string;
}

export class VerifyCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit verification code' })
  @IsString()
  @Length(6, 6, { message: 'The code is 6 digits' })
  code: string;
}
