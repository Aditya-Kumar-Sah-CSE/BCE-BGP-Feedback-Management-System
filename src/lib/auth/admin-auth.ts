import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Admin, AdminRequest } from '@/types/database';

export const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'iambestadi@gmail.com').toLowerCase().trim();

export interface AdminAuthResult {
  isAuthenticated: boolean;
  user: { id: string; email?: string; name?: string } | null;
  admin: Admin | null;
  isSuperAdmin: boolean;
  isApproved: boolean;
  isActive: boolean;
  isPending: boolean;
  isRejected: boolean;
  request?: AdminRequest | null;
}

/**
 * Server-side admin verification and Super Admin auto-promotion.
 * Never relies on client-side email checks alone.
 */
export async function getAdminSession(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const adminDb = createAdminClient() || supabase;

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return {
      isAuthenticated: false,
      user: null,
      admin: null,
      isSuperAdmin: false,
      isApproved: false,
      isActive: false,
      isPending: false,
      isRejected: false,
    };
  }

  const userEmail = user.email.toLowerCase().trim();
  const isSuperAdminEmail = userEmail === SUPER_ADMIN_EMAIL;

  // 1. If Super Admin email, ensure record exists with SUPER_ADMIN + ACTIVE privileges
  if (isSuperAdminEmail) {
    try {
      await supabase.rpc('ensure_super_admin', {
        p_user_id: user.id,
        p_email: userEmail,
        p_name: user.user_metadata?.name || 'Aditya (Super Admin)',
      });
    } catch {
      // Ignored if RPC does not exist
    }

    // Try to fetch existing admin record
    const { data: existingAdmin } = await adminDb
      .from('admins')
      .select('*')
      .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
      .maybeSingle();

    if (!existingAdmin || existingAdmin.role !== 'SUPER_ADMIN' || (existingAdmin.status && existingAdmin.status !== 'ACTIVE') || !existingAdmin.user_id) {
      // Upsert/Promote Super Admin in admins table with schema compatibility
      const basePayload: Record<string, any> = {
        user_id: user.id,
        email: userEmail,
        name: user.user_metadata?.name || 'Aditya (Super Admin)',
        role: 'SUPER_ADMIN',
        updated_at: new Date().toISOString(),
      };

      const { data: initialAdmin, error: upsertErr } = await adminDb
        .from('admins')
        .upsert(
          { ...basePayload, status: 'ACTIVE' },
          { onConflict: 'email' }
        )
        .select('*')
        .maybeSingle();

      let updatedAdmin = initialAdmin;

      if (upsertErr && (upsertErr.message.includes('status') || upsertErr.code === '42703')) {
        const { data: fallbackAdmin } = await adminDb
          .from('admins')
          .upsert(
            basePayload,
            { onConflict: 'email' }
          )
          .select('*')
          .maybeSingle();
        updatedAdmin = fallbackAdmin;
      }

      // Ensure any request is marked as APPROVED (omit updated_at if not present in schema)
      await adminDb
        .from('admin_requests')
        .update({
          status: 'APPROVED',
          reviewed_at: new Date().toISOString(),
        })
        .eq('email', userEmail);

      const rawAdmin = updatedAdmin || existingAdmin;
      const activeAdmin: Admin = rawAdmin
        ? {
            id: rawAdmin.id,
            user_id: user.id,
            email: userEmail,
            name: rawAdmin.name || 'Aditya (Super Admin)',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            created_at: rawAdmin.created_at || new Date().toISOString(),
            updated_at: rawAdmin.updated_at || new Date().toISOString(),
          }
        : {
            id: user.id,
            user_id: user.id,
            email: userEmail,
            name: user.user_metadata?.name || 'Aditya (Super Admin)',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

      return {
        isAuthenticated: true,
        user: { id: user.id, email: user.email, name: activeAdmin.name },
        admin: activeAdmin,
        isSuperAdmin: true,
        isApproved: true,
        isActive: true,
        isPending: false,
        isRejected: false,
      };
    }

    const activeAdmin: Admin = {
      id: existingAdmin.id,
      user_id: user.id,
      email: user.email,
      name: existingAdmin.name,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      created_at: existingAdmin.created_at,
      updated_at: existingAdmin.updated_at,
    };

    return {
      isAuthenticated: true,
      user: { id: user.id, email: user.email, name: existingAdmin.name },
      admin: activeAdmin,
      isSuperAdmin: true,
      isApproved: true,
      isActive: true,
      isPending: false,
      isRejected: false,
    };
  }

  // 2. Normal Admin verification
  const { data: adminRecord } = await supabase
    .from('admins')
    .select('*')
    .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
    .maybeSingle();

  if (adminRecord) {
    const isSuperAdmin = adminRecord.role === 'SUPER_ADMIN';
    const isActive = adminRecord.status === 'ACTIVE' || adminRecord.status === undefined;

    const fullAdmin: Admin = {
      ...adminRecord,
      status: adminRecord.status || 'ACTIVE',
    };

    return {
      isAuthenticated: true,
      user: { id: user.id, email: user.email, name: adminRecord.name },
      admin: fullAdmin,
      isSuperAdmin,
      isApproved: true,
      isActive,
      isPending: false,
      isRejected: false,
    };
  }

  // 3. Not in admins table: Check admin_requests
  const { data: requestRecord } = await supabase
    .from('admin_requests')
    .select('*')
    .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPending = !requestRecord || requestRecord.status === 'PENDING';
  const isRejected = requestRecord?.status === 'REJECTED';

  return {
    isAuthenticated: true,
    user: { id: user.id, email: user.email, name: requestRecord?.name || user.user_metadata?.name },
    admin: null,
    isSuperAdmin: false,
    isApproved: false,
    isActive: false,
    isPending,
    isRejected,
    request: requestRecord,
  };
}
