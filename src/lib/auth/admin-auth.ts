import { createClient } from '@/lib/supabase/server';
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
    // Try to fetch existing admin record
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
      .maybeSingle();

    if (!existingAdmin || existingAdmin.role !== 'SUPER_ADMIN' || existingAdmin.status !== 'ACTIVE' || !existingAdmin.user_id) {
      // Upsert/Promote Super Admin in admins table
      const { data: updatedAdmin } = await supabase
        .from('admins')
        .upsert(
          {
            user_id: user.id,
            email: userEmail,
            name: user.user_metadata?.name || 'Aditya (Super Admin)',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select('*')
        .maybeSingle();

      // Ensure any request is approved
      await supabase
        .from('admin_requests')
        .update({
          status: 'APPROVED',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('email', userEmail);

      const activeAdmin = updatedAdmin || existingAdmin;
      return {
        isAuthenticated: true,
        user: { id: user.id, email: user.email, name: activeAdmin?.name || 'Super Admin' },
        admin: activeAdmin,
        isSuperAdmin: true,
        isApproved: true,
        isActive: true,
        isPending: false,
        isRejected: false,
      };
    }

    return {
      isAuthenticated: true,
      user: { id: user.id, email: user.email, name: existingAdmin.name },
      admin: existingAdmin,
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
    const isActive = adminRecord.status === 'ACTIVE';

    return {
      isAuthenticated: true,
      user: { id: user.id, email: user.email, name: adminRecord.name },
      admin: adminRecord,
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
