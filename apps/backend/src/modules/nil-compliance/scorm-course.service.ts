/**
 * SCORM Course Service
 *
 * Completes Framework NIL's "SCORM learning courses" gap and Opendorse's athlete
 * education. Every course/lesson/enrollment/progress row uses SCORM 1.2 data-model
 * field names (cmi.core.*, cmi.scos.*) so courses can round-trip with any standard
 * LMS.
 *
 * Endpoints:
 *   POST   /scorm/courses                — create a course (DRAFT)
 *   GET    /scorm/courses                — list courses (paginated, filterable by status)
 *   GET    /scorm/courses/:id            — course detail + lessons
 *   PATCH  /scorm/courses/:id            — update course fields
 *   POST   /scorm/courses/:id/publish    — publish a course
 *   POST   /scorm/courses/:id/lessons    — add a lesson
 *   GET    /scorm/courses/:id/lessons    — list lessons
 *
 *   POST   /scorm/enrollments            — enroll a user in a course
 *   GET    /scorm/enrollments            — enrollments for a user (or by course)
 *   GET    /scorm/enrollments/:id        — enrollment detail + progress
 *   POST   /scorm/progress               — record lesson progress (SCORM 1.2 cmi.core.*)
 *   POST   /scorm/complete               — complete an enrollment / roll up scores (SCORM 1.2)
 *
 * SCORM 1.2 conformance:
 *   - scormOrg / scormItem identity fields on ScormCourse
 *   - cmi.core.status, cmi.core.score.raw/min/max, cmi.core.total_time, cmi.core.lesson_location
 *   - cmi.core.credit, cmi.core.suspend_data on ScormProgress / ScormCompletion
 *   - interactions array on ScormProgress mirrors cmi.interactions.*
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { ScormCourseDto, ScormLessonDto, ScormProgressDto, ScormCompleteDto } from './dto/scorm.dto';
import { CourseStatus } from '@prisma/client';

@Injectable()
export class ScormCourseService {
  private readonly logger = new Logger(ScormCourseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  // ─── Course CRUD ──────────────────────────────────────────────────────────────

  async createCourse(callerId: string, dto: ScormCourseDto) {
    const course = await this.prisma.scormCourse.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: CourseStatus.DRAFT,
        scormOrg: dto.scormOrg,
        scormItem: dto.scormItem,
        thumbnailUrl: dto.thumbnailUrl,
        durationMinutes: dto.durationMinutes,
        objectives: dto.objectives ?? [],
        tags: dto.tags ?? [],
        launchUrl: dto.launchUrl,
        launchType: dto.launchType ?? 'scorm_1_2',
        preRequisites: dto.preRequisites ?? [],
        allowedRoles: dto.allowedRoles ?? ['ATHLETE', 'CREATOR'],
        scormDataMap: dto.scormDataMap,
      },
    });

    this.eventBus.emit(EVENTS.SCORM_COURSE_CREATED, { courseId: course.id, callerId });
    void this.auditService.log({ userId: callerId, action: 'SCORM_COURSE_CREATED', resource: 'ScormCourse', resourceId: course.id });

    return course;
  }

  async listCourses(page = 1, take = 25, filters?: { status?: string; search?: string }) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);

    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.scormCourse.findMany({
        where,
        include: { lessons: { orderBy: { position: 'asc' }, take: 50 } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scormCourse.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async getCourse(id: string) {
    const course = await this.prisma.scormCourse.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { position: 'asc' } },
        enrollments: { where: { status: { not: 'NOT_ENROLLED' } }, take: 25 },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(callerId: string, id: string, dto: Partial<ScormCourseDto>) {
    const existing = await this.prisma.scormCourse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Course not found');

    const updated = await this.prisma.scormCourse.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        scormOrg: dto.scormOrg,
        scormItem: dto.scormItem,
        thumbnailUrl: dto.thumbnailUrl,
        durationMinutes: dto.durationMinutes,
        objectives: dto.objectives,
        tags: dto.tags,
        launchUrl: dto.launchUrl,
        launchType: dto.launchType,
        preRequisites: dto.preRequisites,
        allowedRoles: dto.allowedRoles,
        scormDataMap: dto.scormDataMap,
      },
    });

    void this.auditService.log({ userId: callerId, action: 'SCORM_COURSE_UPDATED', resource: 'ScormCourse', resourceId: id });
    return updated;
  }

  async publishCourse(callerId: string, id: string) {
    const existing = await this.prisma.scormCourse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Course not found');
    if (existing.status !== CourseStatus.DRAFT) throw new BadRequestException('Only draft courses can be published');

    const updated = await this.prisma.scormCourse.update({
      where: { id },
      data: { status: CourseStatus.PUBLISHED },
    });

    this.eventBus.emit(EVENTS.SCORM_COURSE_PUBLISHED, { courseId: id, callerId });
    void this.auditService.log({ userId: callerId, action: 'SCORM_COURSE_PUBLISHED', resource: 'ScormCourse', resourceId: id });
    return updated;
  }

  // ─── Lessons ───────────────────────────────────────────────────────────────────

  async addLesson(courseId: string, dto: ScormLessonDto) {
    const course = await this.prisma.scormCourse.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const maxPos = await this.prisma.scormLesson.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (maxPos?.position ?? -1) + 1;

    const lesson = await this.prisma.scormLesson.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        position,
        durationMinutes: dto.durationMinutes,
        contentUrl: dto.contentUrl,
        contentType: dto.contentType ?? 'video',
        scormInteractionId: dto.scormInteractionId,
        masteryScore: dto.masteryScore,
        passingScore: dto.passingScore,
        tags: dto.tags ?? [],
        isRequiredForCertificate: dto.isRequiredForCertificate ?? true,
      },
    });

    void this.auditService.log({ userId: callerId, action: 'SCORM_LESSON_CREATED', resource: 'ScormLesson', resourceId: lesson.id });
    return lesson;
  }

  async listLessons(courseId: string) {
    const course = await this.prisma.scormCourse.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.scormLesson.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
    });
  }

  // ─── Enrollments ──────────────────────────────────────────────────────────────

  async enrollUser(callerId: string, dto: { userId: string; courseId: string; notes?: string }) {
    const course = await this.prisma.scormCourse.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== CourseStatus.PUBLISHED) throw new BadRequestException('Course is not published');

    const enrollment = await this.prisma.scormEnrollment.upsert({
      where: { courseId_userId: { courseId: dto.courseId, userId: dto.userId } },
      create: { courseId: dto.courseId, userId: dto.userId, notes: dto.notes },
      update: {},
    });

    this.eventBus.emit(EVENTS.SCORM_ENROLLMENT_CREATED, { enrollmentId: enrollment.id, courseId: dto.courseId, userId: dto.userId });
    void this.auditService.log({ userId: callerId, action: 'SCORM_ENROLLMENT_CREATED', resource: 'ScormEnrollment', resourceId: enrollment.id });

    return enrollment;
  }

  async listEnrollments(page = 1, take = 25, filters?: { userId?: string; courseId?: string }) {
    const skip = (Math.max(1, page) - 1) * Math.min(take, 100);
    const limit = Math.min(Math.max(1, take), 100);

    const where: Record<string, unknown> = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.courseId) where.courseId = filters.courseId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.scormEnrollment.findMany({
        where,
        include: { course: { select: { id: true, title: true, status: true } } },
        orderBy: { enrolledAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scormEnrollment.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async getEnrollment(id: string) {
    const enrollment = await this.prisma.scormEnrollment.findUnique({
      where: { id },
      include: { course: true, progress: { orderBy: { lessonId: 'asc' } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  // ─── Progress (SCORM 1.2 cmi.core.*) ──────────────────────────────────────────

  async recordProgress(callerId: string, dto: ScormProgressDto) {
    const enrollment = await this.prisma.scormEnrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: { lesson: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const progress = await this.prisma.scormProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: dto.enrollmentId, lessonId: dto.lessonId } },
      create: {
        enrollmentId: dto.enrollmentId,
        lessonId: dto.lessonId,
        status: dto.status ?? 'incomplete',
        scoreRaw: dto.scoreRaw,
        scoreMin: dto.scoreMin,
        scoreMax: dto.scoreMax,
        timeSpent: dto.timeSpent,
        suspendData: dto.suspendData,
        interactions: dto.interactions,
      },
      update: {
        status: dto.status ?? 'incomplete',
        scoreRaw: dto.scoreRaw,
        scoreMin: dto.scoreMin,
        scoreMax: dto.scoreMax,
        timeSpent: dto.timeSpent,
        suspendData: dto.suspendData,
        interactions: dto.interactions,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
      },
    });

    return progress;
  }

  // ─── Completion rollup (SCORM 1.2 rollup) ─────────────────────────────────────

  async completeEnrollment(callerId: string, dto: ScormCompleteDto) {
    const enrollment = await this.prisma.scormEnrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: { course: { include: { lessons: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status === 'COMPLETED' || enrollment.status === 'FAILED') {
      throw new BadRequestException('Enrollment already completed');
    }

    const progressRows = await this.prisma.scormProgress.findMany({
      where: { enrollmentId: dto.enrollmentId },
      orderBy: { lessonId: 'asc' },
    });

    const requiredLessons = enrollment.course.lessons.filter(l => l.isRequiredForCertificate);
    const completedRequired = requiredLessons.filter(l =>
      progressRows.some(p => p.lessonId === l.id && (p.status === 'completed' || p.status === 'passed')),
    );

    const allPassed = requiredLessons.length > 0 && completedRequired.length === requiredLessons.length;

    // Aggregate scores from progress rows
    const scores = progressRows
      .filter(p => p.scoreRaw != null)
      .map(p => p.scoreRaw as number);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    // Total time rollup
    const totalTimeParts = progressRows
      .filter(p => p.timeSpent)
      .map(p => this.parseScormTime(p.timeSpent!));
    const totalTimeMs = totalTimeParts.reduce((a, b) => a + b, 0);

    const passed = allPassed && (dto.passedOverride ?? (avgScore != null && avgScore >= (enrollment.course.lessons.find(l => l.passingScore)?.passingScore ?? 0)));

    const completion = await this.prisma.scormCompletion.create({
      data: {
        enrollmentId: dto.enrollmentId,
        scoreRaw: avgScore,
        scoreMin: dto.scoreMin ?? 0,
        scoreMax: dto.scoreMax ?? 100,
        passed,
        totalTime: this.formatScormTime(totalTimeMs),
        location: dto.location,
        credit: dto.credit ?? true,
        recordsReviewed: progressRows.length,
      },
    });

    await this.prisma.scormEnrollment.update({
      where: { id: dto.enrollmentId },
      data: {
        status: passed ? 'COMPLETED' : 'FAILED',
      },
    });

    this.eventBus.emit(EVENTS.SCORM_COMPLETION_RECORDED, { enrollmentId: dto.enrollmentId, passed });
    void this.auditService.log({ userId: callerId, action: 'SCORM_COMPLETION_RECORDED', resource: 'ScormCompletion', resourceId: completion.id, newValue: { passed, scoreRaw: avgScore } });

    return { completion, enrollment: { ...enrollment, status: passed ? 'COMPLETED' : 'FAILED' } };
  }

  // ─── SCORM 1.2 time helpers ────────────────────────────────────────────────────

  /** Parse SCORM 1.2 time-stamp format "HH:MM:SS.mmm" into milliseconds */
  private parseScormTime(time: string): number {
    const m = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/.exec(time);
    if (!m) return 0;
    const [, h, min, s, ms] = m;
    return (parseInt(h, 10) * 3600 + parseInt(min, 10) * 60 + parseInt(s, 10)) * 1000 + (ms ? parseInt(ms, 10) : 0);
  }

  /** Format milliseconds back into SCORM 1.2 "HH:MM:SS.mmm" */
  private formatScormTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    const millis = String(Math.floor((ms % 1000))).padStart(3, '0');
    return `${h}:${m}:${s}.${millis}`;
  }
}
