"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/types";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login" as any);
}
