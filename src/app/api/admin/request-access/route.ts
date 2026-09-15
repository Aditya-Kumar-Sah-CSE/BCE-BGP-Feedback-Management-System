import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';
import { requestAccessSchema, isValidUUID } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = requestAccessSchema.safeParse(body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      return NextResponse.json(
        { error: issue ? issue.message : 'Invalid request submission data.' },
        { status: 400 }
      );
    }

    const { name, email } = validation.data;
    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdminEmail = cleanEmail === SUPER_ADMIN_EMAIL;

    console.log('[ADMIN_REQUEST_SUBMIT]', { name, email: cleanEmail, isSuperAdminEmail });

    // Use service role admin client on server if available, fallback to SSR client
    const adminSupabase = createAdminClient();
    const supabase = adminSupabase || (await createClient());

    // 1. Resolve Auth user ID safely
    let resolvedUserId = body.userId && isValidUUID(body.userId) ? body.userId : null;

    if (!resolvedUserId && adminSupabase) {
      try {
        const { data: userListData } = await adminSupabase.auth.admin.listUsers();
        const matchedUser = userListData?.users?.find(
          u => u.email?.toLowerCase() === cleanEmail
        );
        if (matchedUser) {
          resolvedUserId = matchedUser.id;
        } else if (body.password && typeof body.password === 'string' && body.password.length >= 6) {
          // If auth user not yet created, create securely in Supabase Auth
          const { data: newAuthData, error: createAuthErr } = await adminSupabase.auth.admin.createUser({
            email: cleanEmail,
            password: body.password,
            email_confirm: true,
            user_metadata: { name },
          });
          if (createAuthErr) {
            console.error('[REQUEST_ACCESS_AUTH_CREATE_ERROR]', createAuthErr);
          } else if (newAuthData?.user) {
            resolvedUserId = newAuthData.user.id;
          }
        }
      } catch (authLookupErr) {
        console.warn('[REQUEST_ACCESS_AUTH_LOOKUP_WARNING]', authLookupErr);
      }
    }

    // 2. If Super Admin, promote immediately on the server
    if (isSuperAdminEmail) {
      const { data: existingAdmin } = await supabase
        .from('admins')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      let adminData;
      const basePayload: Record<string, any> = {
        user_id: resolvedUserId || (existingAdmin ? existingAdmin.user_id : null),
        name,
        role: 'SUPER_ADMIN',
        updated_at: new Date().toISOString(),
      };

      if (existingAdmin) {
        const { data: initialData, error: updateErr } = await supabase
          .from('admins')
          .update({ ...basePayload, status: 'ACTIVE' })
          .eq('id', existingAdmin.id)
          .select('*')
          .maybeSingle();

        let data = initialData;

        if (updateErr && (updateErr.message.includes('status') || updateErr.code === '42703')) {
          const { data: retryData } = await supabase
            .from('admins')
            .update(basePayload)
            .eq('id', existingAdmin.id)
            .select('*')
            .maybeSingle();
          data = retryData;
        }
        adminData = data;
      } else {
        const { data: initialData, error: insertErr } = await supabase
          .from('admins')
          .insert({
            ...basePayload,
            email: cleanEmail,
            status: 'ACTIVE',
          })
          .select('*')
          .maybeSingle();

        let data = initialData;

        if (insertErr && (insertErr.message.includes('status') || insertErr.code === '42703')) {
          const { data: retryData } = await supabase
            .from('admins')
            .insert({
              ...basePayload,
              email: cleanEmail,
            })
            .select('*')
            .maybeSingle();
          data = retryData;
        }
        adminData = data;
      }

      // Also mark any request as approved in admin_requests
      await supabase
        .from('admin_requests')
        .update({
          status: 'APPROVED',
          reviewed_at: new Date().toISOString(),
        })
        .eq('email', cleanEmail);

      return NextResponse.json({ success: true, isSuperAdmin: true, admin: adminData });
    }

    // 3. Check if applicant is already an active admin in admins table
    const { data: existingAdminRecord } = await supabase
      .from('admins')
      .select('id, email, status, role')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingAdminRecord) {
      return NextResponse.json(
        { error: 'An administrator account with this email already exists. Please sign in.' },
        { status: 409 }
      );
    }

    // Ensure resolvedUserId is available before writing to admin_requests (column is NOT NULL)
    if (!resolvedUserId) {
      return NextResponse.json(
        { error: 'Authentication account registration required before submitting admin request.' },
        { status: 400 }
      );
    }

    // 4. Prevent duplicate requests for the same email
    const { data: existingReq } = await supabase
      .from('admin_requests')
      .select('id, status, created_at')
      .eq('email', cleanEmail)
      .maybeSingle();

    const formattedName = name.trim();
    let reqData;

    if (existingReq) {
      if (existingReq.status === 'PENDING') {
        return NextResponse.json({
          success: true,
          isSuperAdmin: false,
          status: 'PENDING',
          alreadyPending: true,
          message: 'An administrator access request for this email is already pending approval from the Super Admin.',
        });
      }

      if (existingReq.status === 'APPROVED') {
        return NextResponse.json(
          { error: 'Your access request has already been approved. Please sign in.' },
          { status: 409 }
        );
      }

      // If previous request was REJECTED, allow re-requesting by updating back to PENDING
      const { data: updatedData, error: updateErr } = await supabase
        .from('admin_requests')
        .update({
          user_id: resolvedUserId,
          name: formattedName,
          status: 'PENDING',
          reviewed_by: null,
          reviewed_at: null,
        })
        .eq('id', existingReq.id)
        .select('*')
        .single();

      if (updateErr) {
        console.error('[ADMIN_REQUEST_UPDATE_ERROR]', {
          code: updateErr.code,
          message: updateErr.message,
          details: updateErr.details,
          hint: updateErr.hint,
        });
        return NextResponse.json({ error: 'Failed to record admin request.' }, { status: 500 });
      }
      reqData = updatedData;
    } else {
      // 5. Insert new PENDING admin request
      // Strictly matches live schema: id, user_id, email, name, status, reviewed_by, reviewed_at, created_at
      const { data: insertedData, error: insertErr } = await supabase
        .from('admin_requests')
        .insert({
          user_id: resolvedUserId,
          email: cleanEmail,
          name: formattedName,
          status: 'PENDING',
        })
        .select('*')
        .single();

      if (insertErr) {
        console.error('[ADMIN_REQUEST_INSERT_ERROR]', {
          code: insertErr.code,
          message: insertErr.message,
          details: insertErr.details,
          hint: insertErr.hint,
        });
        return NextResponse.json({ error: 'Failed to record admin request.' }, { status: 500 });
      }
      reqData = insertedData;
      console.log('[ADMIN_REQUEST_INSERT]', { id: insertedData?.id, email: cleanEmail, status: 'PENDING' });
    }

    // 6. Record audit log (non-blocking)
    try {
      await supabase.from('audit_logs').insert({
        action: 'REQUEST_ADMIN_ACCESS',
        details: `New admin access requested by ${name} (${cleanEmail})`,
      });
    } catch (auditErr) {
      console.warn('[ADMIN_REQUEST_AUDIT_WARNING]', auditErr);
    }

    return NextResponse.json({
      success: true,
      isSuperAdmin: false,
      status: 'PENDING',
      request: reqData,
    });
  } catch (error: unknown) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    console.error('[REQUEST_ACCESS_ERROR]', {
      name: errObj.name,
      message: errObj.message,
      stack: errObj.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
