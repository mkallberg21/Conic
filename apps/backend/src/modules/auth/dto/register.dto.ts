import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'jane@brand.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'P@ssword123!', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).+$/,
    { message: 'Password must contain uppercase, lowercase, number and special character' },
  )
  password: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ enum: [UserRole.BRAND, UserRole.CREATOR, UserRole.AGENCY] })
  @IsEnum(UserRole)
  // ADMIN accounts must be created by an existing admin — never via public registration
  @IsNotIn([UserRole.ADMIN], { message: 'Cannot self-register as ADMIN' })
  role: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  handle?: string;
}
