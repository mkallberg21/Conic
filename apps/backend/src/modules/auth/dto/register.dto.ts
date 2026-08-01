import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotIn,
  IsDateString,
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

  @ApiProperty({ enum: [UserRole.BRAND, UserRole.CREATOR, UserRole.AGENCY, UserRole.ATHLETE, UserRole.GUARDIAN] })
  @IsEnum(UserRole)
  // ADMIN accounts must be created by an existing admin — never via public registration
  @IsNotIn([UserRole.ADMIN], { message: 'Cannot self-register as ADMIN' })
  role: UserRole;

  @ApiProperty({ required: false, description: 'Brand company name (BRAND only)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiProperty({ required: false, description: 'Social handle (CREATOR only)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  handle?: string;

  @ApiProperty({ required: false, description: 'Primary sport (ATHLETE only)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sport?: string;

  @ApiProperty({ required: false, description: 'Mobile phone in international format — verified via SMS 2FA' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, { message: 'Enter a valid phone number' })
  phone?: string;

  @ApiProperty({ required: false, description: 'Date of birth (YYYY-MM-DD) — required for creators/athletes to determine minor status' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, description: "Parent/guardian email — required when the signup is a minor; we email them an invite to co-approve" })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  guardianEmail?: string;

  @ApiProperty({ required: false, example: 'parent', description: 'Relationship of the guardian to the minor' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  guardianRelationship?: string;
}
