import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId, name, email, department } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdminEmail = cleanEmail === SUPER_ADMIN_EMAIL;

    const supabase = await createClient();

    // If Super Admin, promote immediately on the server
    if (isSuperAdminEmail) {
      const { data: adminData, error: adminErr } = await supabase
        .from('admins')
        .upsert(
          {
            user_id: userId || null,
            email: cleanEmail,
            name,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select('*')
        .single();

      if (adminErr) {
        console.error('Super Admin upsert error:', adminErr);
      }

      // Also mark any request as approved
      await supabase
        .from('admin_requests')
        .upsert(
          {
            user_id: userId || null,
            email: cleanEmail,
            name,
            status: 'APPROVED',
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );

      return NextResponse.json({ success: true, isSuperAdmin: true, admin: adminData });
    }

    // Standard admin applicant: Insert or update PENDING request in admin_requests
    const { data: reqData, error: reqErr } = await supabase
      .from('admin_requests')
      .upsert(
        {
          user_id: userId || null,
          email: cleanEmail,
          name: `${name} (${department || 'Faculty'})`,
          status: 'PENDING',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select('*')
      .single();

    if (reqErr) {
      console.error('Admin request insert error:', reqErr);
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }

    // Record audit log for request submission
    await supabase.from('audit_logs').insert({
      actor_email: cleanEmail,
      action: 'REQUEST_ADMIN_ACCESS',
      entity_type: 'admin_requests',
      entity_id: reqData?.id,
      details: `New admin access requested by ${name} (${cleanEmail})`,
    });

    return NextResponse.json({ success: true, isSuperAdmin: false, status: 'PENDING' });
  } catch (error: any) {
    console.error('Request access error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
