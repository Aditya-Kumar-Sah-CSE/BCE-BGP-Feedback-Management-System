import { z } from 'zod';

/**
 * UUID v4 validator
 */
export const uuidSchema = z.string().uuid({ message: 'Invalid identifier format (must be UUID).' });

export function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && uuidSchema.safeParse(val).success;
}

/**
 * Admin Access Request Schema
 */
export const requestAccessSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  department: z.string().trim().max(100).optional(),
});

export const semesterFormItemSchema = z.object({
  facultyId: z.string().uuid('Faculty ID must be a valid UUID'),
  subjectId: z.string().uuid('Subject ID must be a valid UUID'),
  assignmentId: z.string().uuid('Assignment ID must be a valid UUID').optional().nullable(),
});

export type SemesterFormItemInput = z.infer<typeof semesterFormItemSchema>;

/**
 * Form Creation Schema supporting both SEMESTER_FEEDBACK (multi-faculty) and legacy single-faculty forms
 */
export const createFormPayloadSchema = z.object({
  academicYearId: z.string().uuid('Academic Year ID must be a valid UUID'),
  branchId: z.string().uuid('Branch ID must be a valid UUID'),
  semesterId: z.string().uuid('Semester ID must be a valid UUID'),
  formType: z.enum(['SEMESTER_FEEDBACK', 'FACULTY_FEEDBACK', 'FACULTY_SPECIFIC', 'BRANCH_SPECIFIC']),
  facultyId: z.string().uuid('Faculty ID must be a valid UUID').optional().nullable(),
  subjectId: z.string().uuid('Subject ID must be a valid UUID').optional().nullable(),
  items: z.array(semesterFormItemSchema).optional(),
}).refine(data => {
  if (data.formType === 'SEMESTER_FEEDBACK') {
    return Array.isArray(data.items) && data.items.length > 0;
  }
  return Boolean(data.facultyId && data.subjectId);
}, {
  message: 'For SEMESTER_FEEDBACK, at least one faculty-subject item is required. For single-faculty forms, facultyId and subjectId are required.',
});

export type CreateFormPayload = z.infer<typeof createFormPayloadSchema>;


/**
 * Feedback Form Lifecycle Status Schema
 */
export const formStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']);

/**
 * Academic Year Creation Schema
 */
export const academicYearSchema = z.object({
  name: z.string().trim().min(4, 'Session name too short (e.g. 2025-2026)').max(20),
  is_active: z.boolean().default(false),
});

/**
 * Faculty Creation Schema
 */
export const facultySchema = z.object({
  name: z.string().trim().min(2, 'Faculty name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format').toLowerCase().optional().or(z.literal('')),
  department: z.string().trim().min(2, 'Department name required').max(100),
  designation: z.string().trim().min(2, 'Designation required').max(100),
  is_active: z.boolean().default(true),
});

/**
 * Subject Creation Schema
 */
export const subjectSchema = z.object({
  name: z.string().trim().min(2, 'Subject name required').max(150),
  code: z.string().trim().min(2, 'Subject code required').max(30),
  branch_id: z.string().uuid('Branch must be selected').optional().nullable(),
  semester_id: z.string().uuid('Semester must be selected').optional().nullable(),
  is_active: z.boolean().default(true),
});
