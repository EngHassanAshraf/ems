"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/types";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});

export async function signIn(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  const { email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[signIn] Supabase error:", error.message);
    return { success: false, error: "auth.invalidCredentials" };
  }

  return { success: true, data: { redirectTo: "/dashboard" } };
}

export async function signUp(input: unknown): Promise<ActionResult<null>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[signUp] Validation error:", parsed.error.flatten());
    return { success: false, error: "errors.invalidInput" };
  }

  const { email, password, fullName } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  console.log("[signUp] result:", JSON.stringify({ user: data?.user?.id, email: data?.user?.email, confirmed: data?.user?.confirmed_at, error }));

  if (error) {
    console.error("[signUp] Supabase error:", error.message, error.status);
    return { success: false, error: "auth.signUpError" };
  }

  // Auto sign-in after signup (works when email confirmation is disabled)
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  console.log("[signUp] auto sign-in:", signInError ? signInError.message : "ok");

  return { success: true, data: null };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login" as any);
}
