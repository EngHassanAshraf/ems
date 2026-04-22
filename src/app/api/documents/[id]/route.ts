import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const download = request.nextUrl.searchParams.get("download") === "1";

  // Verify auth
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get document
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Generate signed URL using admin client (bypasses RLS, works on Vercel)
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(doc.storageBucket)
    .createSignedUrl(doc.storagePath, 300, {
      download: download
        ? (doc.title ?? doc.storagePath.split("/").pop() ?? "document")
        : false,
    });

  if (error || !data) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
