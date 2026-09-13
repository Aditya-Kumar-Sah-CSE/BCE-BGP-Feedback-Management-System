'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSession, SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';

async function getAdminDb() {
  return createAdminClient() || await createClient();
}

// Helper: record audit log
async function logAuditAction(
  supabase: any,
  actor: { adminId?: string | null; email?: string },
  action: string,
  entityType: string,
  entityId: string,
  details: string
) {
  try {
    await supabase.from('audit_logs').insert({
      admin_id: actor.adminId || null,
      actor_email: actor.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// -------------------------------------------------------------
// 1. ADMIN MANAGEMENT (SUPER ADMIN ONLY)
// -------------------------------------------------------------

export async function approveAdminRequestAction(requestId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only a Super Admin can approve requests.' };
  }

  const supabase = await getAdminDb();

  // Get request details
  const { data: req, error: fetchErr } = await supabase
    .from('admin_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) {
    return { success: false, error: 'Request not found.' };
  }

  // Create / activate admin in admins table with schema fallback
  const baseAdminPayload = {
    user_id: req.user_id || null,
    email: req.email.toLowerCase().trim(),
    name: req.name,
    role: 'ADMIN',
    updated_at: new Date().toISOString(),
  };

  let { data: newAdmin, error: adminErr } = await supabase
    .from('admins')
    .upsert(
      {
        ...baseAdminPayload,
        status: 'ACTIVE',
      },
      { onConflict: 'email' }
    )
    .select('*')
    .single();

  if (adminErr && (adminErr.message.includes('status') || adminErr.code === '42703')) {
    const { data: fallbackAdmin, error: fallbackErr } = await supabase
      .from('admins')
      .upsert(
        baseAdminPayload,
        { onConflict: 'email' }
      )
      .select('*')
      .single();
    newAdmin = fallbackAdmin;
    adminErr = fallbackErr;
  }

  if (adminErr) {
    return { success: false, error: adminErr.message };
  }

  // Update request status (omit updated_at if not present in schema)
  await supabase
    .from('admin_requests')
    .update({
      status: 'APPROVED',
      reviewed_by: session.admin?.id || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // Audit
  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'APPROVE_ADMIN_REQUEST',
    'admin_requests',
    requestId,
    `Approved admin request for ${req.email} (${req.name})`
  );

  revalidatePath('/admin/dashboard');
  return { success: true, admin: newAdmin };
}

export async function rejectAdminRequestAction(requestId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only a Super Admin can reject requests.' };
  }

  const supabase = await getAdminDb();

  // Get request details
  const { data: req, error: fetchErr } = await supabase
    .from('admin_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) {
    return { success: false, error: 'Request not found.' };
  }

  await supabase
    .from('admin_requests')
    .update({
      status: 'REJECTED',
      reviewed_by: session.admin?.id || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'REJECT_ADMIN_REQUEST',
    'admin_requests',
    requestId,
    `Rejected admin request for ${req.email}`
  );

  revalidatePath('/admin/dashboard');
  return { success: true };
}

export async function toggleAdminStatusAction(targetAdminId: string, newStatus: 'ACTIVE' | 'INACTIVE') {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only a Super Admin can change admin status.' };
  }

  const supabase = await getAdminDb();

  const { data: target, error: fetchErr } = await supabase
    .from('admins')
    .select('*')
    .eq('id', targetAdminId)
    .single();

  if (fetchErr || !target) {
    return { success: false, error: 'Admin record not found.' };
  }

  if (target.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL && newStatus === 'INACTIVE') {
    return { success: false, error: 'The primary Super Admin cannot be deactivated.' };
  }

  let { error: updateErr } = await supabase
    .from('admins')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetAdminId);

  if (updateErr && (updateErr.message.includes('status') || updateErr.code === '42703')) {
    const { error: fallbackErr } = await supabase
      .from('admins')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetAdminId);
    updateErr = fallbackErr;
  }

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'TOGGLE_ADMIN_STATUS',
    'admins',
    targetAdminId,
    `Changed status of admin ${target.email} to ${newStatus}`
  );

  revalidatePath('/admin/dashboard');
  return { success: true };
}

// -------------------------------------------------------------
// 2. ACADEMIC YEARS CRUD
// -------------------------------------------------------------

export async function createAcademicYearAction(data: { name: string; is_active: boolean }) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data: newYear, error } = await supabase
    .from('academic_years')
    .insert({
      name: data.name.trim(),
      is_active: data.is_active,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'CREATE_ACADEMIC_YEAR',
    'academic_years',
    newYear.id,
    `Created academic year ${newYear.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true, year: newYear };
}

export async function updateAcademicYearAction(id: string, data: { name: string; is_active: boolean }) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { error } = await supabase
    .from('academic_years')
    .update({
      name: data.name.trim(),
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'UPDATE_ACADEMIC_YEAR',
    'academic_years',
    id,
    `Updated academic year ${data.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}

// -------------------------------------------------------------
// 3. BRANCHES CRUD
// -------------------------------------------------------------

export async function createBranchAction(data: { name: string; code: string; is_active: boolean }) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data: newBranch, error } = await supabase
    .from('branches')
    .insert({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      is_active: data.is_active,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'CREATE_BRANCH',
    'branches',
    newBranch.id,
    `Created branch ${newBranch.name} (${newBranch.code})`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true, branch: newBranch };
}

export async function updateBranchAction(id: string, data: { name: string; code: string; is_active: boolean }) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { error } = await supabase
    .from('branches')
    .update({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'UPDATE_BRANCH',
    'branches',
    id,
    `Updated branch ${data.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}

// -------------------------------------------------------------
// 4. SEMESTERS CRUD
// -------------------------------------------------------------

export async function createSemesterAction(data: { name: string; year_number: number; semester_number: number; is_active: boolean }) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data: newSem, error } = await supabase
    .from('semesters')
    .insert({
      name: data.name.trim(),
      year_number: Number(data.year_number),
      semester_number: Number(data.semester_number),
      is_active: data.is_active,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'CREATE_SEMESTER',
    'semesters',
    newSem.id,
    `Created semester ${newSem.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true, semester: newSem };
}

export async function updateSemesterAction(id: string, data: { name: string; year_number: number; semester_number: number; is_active: boolean }) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { error } = await supabase
    .from('semesters')
    .update({
      name: data.name.trim(),
      year_number: Number(data.year_number),
      semester_number: Number(data.semester_number),
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'UPDATE_SEMESTER',
    'semesters',
    id,
    `Updated semester ${data.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}

// -------------------------------------------------------------
// 5. FACULTIES CRUD
// -------------------------------------------------------------

export async function createFacultyAction(data: {
  name: string;
  employee_id?: string;
  department: string;
  designation: string;
  is_active: boolean;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();

  const payload: Record<string, any> = {
    name: data.name.trim(),
    department: data.department.trim(),
    designation: data.designation.trim(),
    is_active: data.is_active,
  };

  if (data.employee_id?.trim()) {
    payload.employee_id = data.employee_id.trim();
  }

  let { data: newFaculty, error } = await supabase
    .from('faculties')
    .insert(payload)
    .select('*')
    .single();

  // If column employee_id is missing in database schema or schema cache
  if (error && (error.message.includes('employee_id') || error.code === 'PGRST204' || error.code === '42703')) {
    delete payload.employee_id;
    const fallbackRes = await supabase
      .from('faculties')
      .insert(payload)
      .select('*')
      .single();
    newFaculty = fallbackRes.data;
    error = fallbackRes.error;
  }

  // If department or designation are also missing in bare schema
  if (error && (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST204' || error.code === '42703')) {
    const minimalRes = await supabase
      .from('faculties')
      .insert({
        name: data.name.trim(),
        is_active: data.is_active,
      })
      .select('*')
      .single();
    newFaculty = minimalRes.data;
    error = minimalRes.error;
  }

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'CREATE_FACULTY',
    'faculties',
    newFaculty.id,
    `Created faculty ${newFaculty.name} (${newFaculty.department || 'General'})`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true, faculty: newFaculty };
}

export async function updateFacultyAction(
  id: string,
  data: {
    name: string;
    employee_id?: string;
    department: string;
    designation: string;
    is_active: boolean;
  }
) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();

  const payload: Record<string, any> = {
    name: data.name.trim(),
    department: data.department.trim(),
    designation: data.designation.trim(),
    is_active: data.is_active,
    updated_at: new Date().toISOString(),
  };

  if (data.employee_id?.trim()) {
    payload.employee_id = data.employee_id.trim();
  }

  let { error } = await supabase
    .from('faculties')
    .update(payload)
    .eq('id', id);

  // If column employee_id is missing in database schema or schema cache
  if (error && (error.message.includes('employee_id') || error.code === 'PGRST204' || error.code === '42703')) {
    delete payload.employee_id;
    const fallbackRes = await supabase
      .from('faculties')
      .update(payload)
      .eq('id', id);
    error = fallbackRes.error;
  }

  if (error && (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST204' || error.code === '42703')) {
    const minimalRes = await supabase
      .from('faculties')
      .update({
        name: data.name.trim(),
        is_active: data.is_active,
      })
      .eq('id', id);
    error = minimalRes.error;
  }

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'UPDATE_FACULTY',
    'faculties',
    id,
    `Updated faculty ${data.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}

// -------------------------------------------------------------
// 6. SUBJECTS CRUD
// -------------------------------------------------------------

export async function createSubjectAction(data: {
  name: string;
  code: string;
  semester_id?: string;
  branch_id?: string;
  is_active: boolean;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data: newSubject, error } = await supabase
    .from('subjects')
    .insert({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      semester_id: data.semester_id || null,
      branch_id: data.branch_id || null,
      is_active: data.is_active,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'CREATE_SUBJECT',
    'subjects',
    newSubject.id,
    `Created subject ${newSubject.name} (${newSubject.code})`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true, subject: newSubject };
}

export async function updateSubjectAction(
  id: string,
  data: {
    name: string;
    code: string;
    semester_id?: string;
    branch_id?: string;
    is_active: boolean;
  }
) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { error } = await supabase
    .from('subjects')
    .update({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      semester_id: data.semester_id || null,
      branch_id: data.branch_id || null,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'UPDATE_SUBJECT',
    'subjects',
    id,
    `Updated subject ${data.name}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}

// -------------------------------------------------------------
// 7. FACULTY-SUBJECT ASSIGNMENTS CRUD
// -------------------------------------------------------------

export async function createAssignmentAction(data: {
  faculty_id: string;
  subject_id: string;
  academic_year_id: string;
  branch_id?: string;
  semester_id?: string;
  is_active: boolean;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data: newAssign, error } = await supabase
    .from('faculty_subject_assignments')
    .insert({
      faculty_id: data.faculty_id,
      subject_id: data.subject_id,
      academic_year_id: data.academic_year_id,
      branch_id: data.branch_id || null,
      semester_id: data.semester_id || null,
      is_active: data.is_active,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'ASSIGN_FACULTY_SUBJECT',
    'faculty_subject_assignments',
    newAssign.id,
    `Assigned faculty to subject in session`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true, assignment: newAssign };
}

export async function deleteAssignmentAction(id: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { error } = await supabase
    .from('faculty_subject_assignments')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'DELETE_FACULTY_ASSIGNMENT',
    'faculty_subject_assignments',
    id,
    `Removed faculty-subject assignment`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}

// -------------------------------------------------------------
// 8. FEEDBACK FORMS FOUNDATION (PHASE 1)
// -------------------------------------------------------------

export async function createFeedbackFormDraftAction(data: {
  title: string;
  academic_year_id: string;
  branch_id: string;
  semester_id: string;
  faculty_id: string;
  subject_id: string;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const slug = `bce-fb-${Date.now()}`;

  const { data: form, error } = await supabase
    .from('feedback_forms')
    .insert({
      title: data.title.trim(),
      academic_year_id: data.academic_year_id,
      branch_id: data.branch_id,
      semester_id: data.semester_id,
      faculty_id: data.faculty_id,
      subject_id: data.subject_id,
      form_type: 'FACULTY_FEEDBACK',
      status: 'DRAFT',
      slug,
      created_by: session.admin?.id || null,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'CREATE_FEEDBACK_FORM_DRAFT',
    'feedback_forms',
    form.id,
    `Created feedback form draft: ${data.title}`
  );

  revalidatePath('/admin/dashboard');
  return { success: true, form };
}

export async function toggleFeedbackFormStatusAction(formId: string, status: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { error } = await supabase
    .from('feedback_forms')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', formId);

  if (error) return { success: false, error: error.message };

  await logAuditAction(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'UPDATE_FORM_STATUS',
    'feedback_forms',
    formId,
    `Changed form status to ${status}`
  );

  revalidatePath('/admin/dashboard');
  revalidatePath('/');
  return { success: true };
}
