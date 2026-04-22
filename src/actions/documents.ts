"use server";

import { prisma } from "@/lib/prisma";
import { getServerUser } from "@/lib/auth/user";
import { type ActionResult } from "@/actions/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Document } from "@prisma/client";

const uploadMetadataSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(["introduction", "contract", "attachment"]),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function uploadDocument(
  formData: FormData
): Promise<ActionResult<Document>> {
  await getServerUser();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: "errors.invalidInput" };
  }

  const metadata = {
    employeeId: formData.get("employeeId") as string,
    type: formData.get("type") as string,
    title: formData.get("title") as string | null,
    description: formData.get("description") as string | null,
  };

  const parsed = uploadMetadataSchema.safeParse(metadata);
  if (!parsed.success) {
    return { success: false, error: "errors.invalidInput" };
  }

  const { employeeId, type, title, description } = parsed.data;

  try {
    const doc = await prisma.document.create({
      data: {
        employeeId,
        type,
        title: title || file.name, // preserve original name (including Arabic) in title
        description,
        storageBucket: "employee-documents",
        storagePath: "pending",
        mimeType: file.type,
        byteSize: BigInt(file.size),
        version: 1,
      },
    });

    const safeName = file.name
      .normalize("NFD")
      .replace(/[^\x00-\x7F]/g, "") // strip non-ASCII (Arabic, etc.)
      .replace(/\s+/g, "-")          // spaces to dashes
      .replace(/[^a-zA-Z0-9._-]/g, "") // keep only safe chars
      || `file-${Date.now()}`;        // fallback if name becomes empty

    const storagePath = `employee/${employeeId}/document/${doc.id}/v1/${safeName}`;

    const supabase = await createSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from("employee-documents")
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      console.error("[uploadDocument] storage error:", uploadError.message, uploadError);
      await prisma.document.delete({ where: { id: doc.id } });
      return { success: false, error: "errors.uploadFailed" };
    }

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { storagePath },
    });

    revalidatePath("/employees/[id]", "page");
    return { success: true, data: updated };
  } catch (err) {
    console.error("[uploadDocument]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function deleteDocument(id: string): Promise<ActionResult<null>> {
  await getServerUser();

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return { success: false, error: "errors.notFound" };
    }

    const supabase = await createSupabaseServerClient();
    await supabase.storage.from(doc.storageBucket).remove([doc.storagePath]);

    await prisma.document.delete({ where: { id } });

    revalidatePath("/employees/[id]", "page");
    return { success: true, data: null };
  } catch (err) {
    console.error("[deleteDocument]", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function getSignedUrl(
  id: string
): Promise<ActionResult<{ url: string }>> {
  await getServerUser();

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return { success: false, error: "errors.notFound" };
    }

    console.log("[getSignedUrl] storagePath:", doc.storagePath, "bucket:", doc.storageBucket);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from(doc.storageBucket)
      .createSignedUrl(doc.storagePath, 300);

    console.log("[getSignedUrl] result:", { url: data?.signedUrl?.slice(0, 60), error: error?.message });

    if (error || !data) {
      return { success: false, error: "errors.serverError" };
    }

    return { success: true, data: { url: data.signedUrl } };
  } catch (err) {
    console.error("[getSignedUrl] exception:", err);
    return { success: false, error: "errors.serverError" };
  }
}

export async function listDocuments(
  employeeId: string
): Promise<ActionResult<Document[]>> {
  await getServerUser();

  try {
    const docs = await prisma.document.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: "desc" },
    });
    return { success: true, data: docs };
  } catch (err) {
    console.error("[listDocuments]", err);
    return { success: false, error: "errors.serverError" };
  }
}
