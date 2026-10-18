import { z } from 'zod';
export const createCourseSchema = z.strictObject({
  title: z.string().trim().min(2).max(160),
  description: z.string().max(5000).default(''),
});
export const updateCourseSchema = z
  .strictObject({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().max(5000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Supply at least one field');
export const studentSchema = z.strictObject({ studentId: z.uuid() });
export const lecturerSchema = z.strictObject({ lecturerId: z.uuid() });
