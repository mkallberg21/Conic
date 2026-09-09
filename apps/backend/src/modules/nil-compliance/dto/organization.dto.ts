import { IsString, IsOptional, IsEnum, IsInt, IsArray, ValidateIf } from 'class-validator';
import { OrganizationType, OrganizationStatus, UserOrganizationRole } from '@prisma/client';

export class OrganizationDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsEnum(OrganizationType)
  type: OrganizationType;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  scormLaunchBaseUrl?: string;

  @IsOptional()
  @IsString()
  lmsOrgId?: string;

  @IsOptional()
  @IsArray()
  defaultAllowedRoles?: string[];
}

export class OrganizationChildDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsEnum(OrganizationType)
  type: OrganizationType;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  scormLaunchBaseUrl?: string;

  @IsOptional()
  @IsString()
  lmsOrgId?: string;

  @IsOptional()
  @IsArray()
  defaultAllowedRoles?: string[];
}

export class OrganizationMemberDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(UserOrganizationRole)
  role?: UserOrganizationRole;

  @IsOptional()
  @IsString()
  memberCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
