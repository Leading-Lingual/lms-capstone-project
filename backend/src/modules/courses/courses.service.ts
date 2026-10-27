import type { Course, Role } from '../../generated/prisma/client.js';
import type { Database } from '../../infrastructure/database/client.js';
import { transaction } from '../../infrastructure/database/transaction.js';
import { AppError } from '../../lib/errors.js';
import { audit } from '../audit/audit.service.js';
import { requireAdmin } from '../users/users.service.js';

export function createCoursesService(db: Database) {
  const get = async (id: string, userId: string, role: Role) => {
    const course = await db.course.findFirst({
      where: {
        id,
        ...(role === 'STUDENT'
          ? { status: 'PUBLISHED', enrolments: { some: { studentId: userId } } }
          : {}),
        ...(role === 'LECTURER' ? { lecturers: { some: { lecturerId: userId } } } : {}),
      },
    });
    if (!course) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
    return course;
  };
  return {
    get,
    async list(userId: string, role: Role, page: number, limit: number) {
      return db.course.findMany({
        where: {
          ...(role === 'STUDENT'
            ? { status: 'PUBLISHED', enrolments: { some: { studentId: userId } } }
            : {}),
          ...(role === 'LECTURER' ? { lecturers: { some: { lecturerId: userId } } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      });
    },
    async create(
      input: { title: string; description: string },
      actorId: string,
      requestId: string,
    ) {
      return transaction(db, async (tx) => {
        await requireAdmin(tx, actorId);
        const course = await tx.course.create({ data: { ...input, ownerId: actorId } });
        await audit(tx, actorId, requestId, 'COURSE_CREATED', course.id);
        return course;
      });
    },
    async change(
      id: string,
      input: { title?: string; description?: string; status?: 'PUBLISHED'; archivedAt?: Date },
      actorId: string,
      requestId: string,
    ) {
      return transaction(db, async (tx) => {
        await requireAdmin(tx, actorId);
        const course = await tx.course.findUnique({ where: { id } });
        if (!course) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
        if (course.archivedAt) {
          if (input.archivedAt) return course;
          throw new AppError(409, 'COURSE_ARCHIVED', 'Archived courses are read-only.');
        }
        const updated = await tx.course.update({ where: { id }, data: input });
        await audit(
          tx,
          actorId,
          requestId,
          input.archivedAt
            ? 'COURSE_ARCHIVED'
            : input.status
              ? 'COURSE_PUBLISHED'
              : 'COURSE_UPDATED',
          id,
        );
        return updated;
      });
    },
    async membership(
      id: string,
      memberId: string,
      kind: 'STUDENT' | 'LECTURER',
      remove: boolean,
      actorId: string,
      requestId: string,
    ) {
      return transaction(db, async (tx) => {
        await requireAdmin(tx, actorId);
        const course: Course | null = await tx.course.findUnique({ where: { id } });
        if (!course) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
        // Removal remains possible for security and administration on archived courses.
        if (course.archivedAt && !remove)
          throw new AppError(409, 'COURSE_ARCHIVED', 'Archived courses accept no new members.');
        if (!remove) {
          const user = await tx.user.findUnique({ where: { id: memberId } });
          if (
            !user ||
            user.role !== kind ||
            !user.isActive ||
            !user.emailVerifiedAt ||
            (kind === 'LECTURER' && !user.lecturerApprovedAt)
          ) {
            throw new AppError(
              409,
              'MEMBER_INELIGIBLE',
              'The user is not eligible for this course membership.',
            );
          }
        }
        let changed = false;
        if (kind === 'STUDENT') {
          const where = { courseId: id, studentId: memberId };
          if (remove) changed = (await tx.enrolment.deleteMany({ where })).count > 0;
          else if (!(await tx.enrolment.findUnique({ where: { courseId_studentId: where } }))) {
            await tx.enrolment.create({ data: where });
            changed = true;
          }
        } else {
          const where = { courseId: id, lecturerId: memberId };
          if (remove) changed = (await tx.courseLecturer.deleteMany({ where })).count > 0;
          else if (
            !(await tx.courseLecturer.findUnique({ where: { courseId_lecturerId: where } }))
          ) {
            await tx.courseLecturer.create({ data: where });
            changed = true;
          }
        }
        if (changed)
          await audit(
            tx,
            actorId,
            requestId,
            `${kind}_MEMBERSHIP_${remove ? 'REMOVED' : 'ADDED'}`,
            id,
            { memberId },
          );
        return { courseId: id, memberId, kind, enrolled: !remove };
      });
    },
  };
}
