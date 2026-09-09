/**
 * SCORM Course Controller
 * Exposes the SCORM 1.2 LMS endpoints under /v1/scorm
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Roles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScormCourseService } from './scorm-course.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ScormCourseDto, ScormLessonDto, ScormProgressDto, ScormCompleteDto } from './dto/scorm.dto';
import { UserRole } from '@prisma/client';

import { ScormCourseService } from './scorm-course.service';

@Controller('v1/scorm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScormCourseController {
  constructor(private readonly scormService: ScormCourseService) {}

  // ─── Courses ────────────────────────────────────────────────────────────────

  @Post('courses')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  createCourse(@CurrentUser() user: { userId: string }, @Body() dto: ScormCourseDto) {
    return this.scormService.createCourse(user.userId, dto);
  }

  @Get('courses')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  listCourses(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.scormService.listCourses(page, take, { status, search });
  }

  @Get('courses/:id')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  getCourse(@Param('id') id: string) {
    return this.scormService.getCourse(id);
  }

  @Patch('courses/:id')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  updateCourse(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: Partial<ScormCourseDto>,
  ) {
    return this.scormService.updateCourse(user.userId, id, dto);
  }

  @Post('courses/:id/publish')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  publishCourse(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.scormService.publishCourse(user.userId, id);
  }

  // ─── Lessons ────────────────────────────────────────────────────────────────

  @Post('courses/:courseId/lessons')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  addLesson(@Param('courseId') courseId: string, @Body() dto: ScormLessonDto) {
    return this.scormService.addLesson(courseId, dto);
  }

  @Get('courses/:courseId/lessons')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  listLessons(@Param('courseId') courseId: string) {
    return this.scormService.listLessons(courseId);
  }

  // ─── Enrollments ────────────────────────────────────────────────────────────

  @Post('enrollments')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  enrollUser(@CurrentUser() user: { userId: string }, @Body() dto: { userId: string; courseId: string; notes?: string }) {
    return this.scormService.enrollUser(user.userId, dto);
  }

  @Get('enrollments')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  listEnrollments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('userId') userId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.scormService.listEnrollments(page, take, { userId, courseId });
  }

  @Get('enrollments/:id')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  getEnrollment(@Param('id') id: string) {
    return this.scormService.getEnrollment(id);
  }

  // ─── Progress / Completion (SCORM 1.2 runtime) ──────────────────────────────

  @Post('progress')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  recordProgress(@CurrentUser() user: { userId: string }, @Body() dto: ScormProgressDto) {
    return this.scormService.recordProgress(user.userId, dto);
  }

  @Post('complete')
  @Roles(UserRole.ATHLETE, UserRole.AGENT, UserRole.BRAND, UserRole.COMPANY_ADMIN, UserRole.ADMIN)
  completeEnrollment(@CurrentUser() user: { userId: string }, @Body() dto: ScormCompleteDto) {
    return this.scormService.completeEnrollment(user.userId, dto);
  }
}
