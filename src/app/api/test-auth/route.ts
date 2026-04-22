import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Check raw env vars first
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      DIRECT_URL: !!process.env.DIRECT_URL,
    };

    const supabase = await createSupabaseServerClient();

    const email = `test-${Date.now()}@test.com`;
    const password = "TestPass123!";

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: "Test User" } },
    });

    if (signUpError) {
      return NextResponse.json({ step: "signup", ok: false, envCheck, error: { message: signUpError.message, status: signUpError.status } });
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    return NextResponse.json({
      envCheck,
      signup: { ok: true, userId: signUpData.user?.id },
      login: {
        ok: !signInError,
        hasSession: !!signInData?.session,
        error: signInError ? { message: signInError.message } : null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ crashed: true, message: String(e) }, { status: 500 });
  }
}
