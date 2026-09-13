import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const { name, email, department } = validation.data;
    const userId = body.userId && isValidUUID(body.userId) ? body.userId : null;

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdminEmail = cleanEmail === SUPER_ADMIN_EMAIL;

    const supabase = await createClient();

    // If Super Admin, promote immediately on the server
    if (isSuperAdminEmail) {
      const { data: existingAdmin } = await supabase
        .from('admins')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      let adminData;
      if (existingAdmin) {
        const { data } = await supabase
          .from('admins')
          .update({
            user_id: userId || existingAdmin.user_id,
            name,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
          })
          .eq('id', existingAdmin.id)
          .select('*')
          .maybeSingle();
        adminData = data;
      } else {
        const { data } = await supabase
          .from('admins')
          .insert({
            user_id: userId || null,
            email: cleanEmail,
            name,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
          })
          .select('*')
          .maybeSingle();
        adminData = data;
      }

      // Also mark any request as approved
      await supabase
        .from('admin_requests')
        .update({
          status: 'APPROVED',
          reviewed_at: new Date().toISOString(),
        })
        .eq('email', cleanEmail);

      return NextResponse.json({ success: true, isSuperAdmin: true, admin: adminData });
    }

    // Standard admin applicant: Insert or update PENDING request in admin_requests
    const { data: existingReq } = await supabase
      .from('admin_requests')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    let reqData;
    if (existingReq) {
      const { data, error } = await supabase
        .from('admin_requests')
        .update({
          user_id: userId || null,
          name: `${name} (${department || 'Faculty'})`,
          status: 'PENDING',
        })
        .eq('id', existingReq.id)
        .select('*')
        .single();

      if (error) {
        console.error('Admin request update error:', error);
        return NextResponse.json({ error: 'Failed to update admin request.' }, { status: 500 });
      }
      reqData = data;
    } else {
      const { data, error } = await supabase
        .from('admin_requests')
        .insert({
          user_id: userId || null,
          email: cleanEmail,
          name: `${name} (${department || 'Faculty'})`,
          status: 'PENDING',
        })
        .select('*')
        .single();

      if (error) {
        console.error('Admin request insert error:', error);
        return NextResponse.json({ error: 'Failed to record admin request.' }, { status: 500 });
      }
      reqData = data;
    }

    // Record audit log for request submission
    await supabase.from('audit_logs').insert({
      action: 'REQUEST_ADMIN_ACCESS',
      details: `New admin access requested by ${name} (${cleanEmail})`,
    });

    return NextResponse.json({ success: true, isSuperAdmin: false, status: 'PENDING', request: reqData });
  } catch (error: unknown) {
    console.error('Request access error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
