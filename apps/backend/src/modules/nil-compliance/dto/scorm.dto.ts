import { IsString, IsOptional, IsInt, IsArray, IsEnum, ValidateIf } from 'class-validator';

export class ScormCourseDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scormOrg?: string; // SCORM 1.2 organization identifier

  @IsOptional()
  @IsString()
  scormItem?: string; // SCORM 1.2 item identifier

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  objectives?: string[]; // SCORM 1.2 objectives

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  launchUrl?: string;

  @IsOptional()
  @IsString()
  launchType?: string; // scorm_1_2 | external | video

  @IsOptional()
  @IsArray()
  preRequisites?: string[]; // course ids

  @IsOptional()
  @IsArray()
  allowedRoles?: string[];

  @IsOptional()
  @IsString()
  scormDataMap?: string; // JSON string of SCORM 1.2 cmi.* fields
}

export class ScormLessonDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  contentUrl?: string;

  @IsOptional()
  @IsString()
  contentType?: string; // video | pdf | html | image | quiz

  @IsOptional()
  @IsString()
  scormInteractionId?: string;

  @IsOptional()
  @IsInt()
  masteryScore?: number;

  @IsOptional()
  @IsInt()
  passingScore?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsInt()
  isRequiredForCertificate?: number; // 0|1
}

export class ScormProgressDto {
  @IsString()
  enrollmentId: string;

  @IsString()
  lessonId: string;

  @IsOptional()
  @IsString()
  status?: string; // incomplete | completed | passed | failed | browsed

  @IsOptional()
  @IsInt()
  scoreRaw?: number;

  @IsOptional()
  @IsInt()
  scoreMin?: number;

  @IsOptional()
  @IsInt()
  scoreMax?: number;

  @IsOptional()
  @IsString()
  timeSpent?: string; // SCORM 1.2 time-stamp format HH:MM:SS.mmm

  @IsOptional()
  @IsString()
  suspendData?: string; // opaque SCORM 1.2 suspend_data

  @IsOptional()
  @IsString()
  interactions?: string; // JSON string of interaction records

  @IsOptional()
  @IsString()
  completedAt?: string; // ISO timestamp
}

export class ScormCompleteDto {
  @IsString()
  enrollmentId: string;

  @IsOptional()
  @IsInt()
  scoreMin?: number;

  @IsOptional()
  @IsInt()
  scoreMax?: number;

  @IsOptional()
  @IsInt()
  passedOverride?: number; // 0|1 explicit pass/fail override

  @IsOptional()
  @IsString()
  location?: string; // cmi.core.lesson_location bookmark

  @IsOptional()
  @IsInt()
  credit?: number; // 0|1
}
