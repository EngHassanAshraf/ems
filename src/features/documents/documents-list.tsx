"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FileText, Download, Trash2, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { DocumentUploadForm } from "./document-upload-form";
import { deleteDocument as deleteDocumentAction, getSignedUrl } from "@/actions/documents";
import type { Document } from "@prisma/client";

type DocumentType = "introduction" | "contract" | "attachment";

const TYPE_VARIANT: Record<DocumentType, "default" | "success" | "secondary"> = {
  introduction: "default",
  contract: "success",
  attachment: "secondary",
};

interface DocumentsListProps {
  employeeId: string;
  companyId: string;
  documents: Document[];
  isLoading: boolean;
}

export function DocumentsList({ employeeId, companyId, documents, isLoading }: DocumentsListProps) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const handleOpen = async (doc: Document) => {
    setOpening(doc.id);
    try {
      const result = await getSignedUrl(doc.id);
      if (!result.success) { toast("error", result.error); return; }
      window.open(result.data.url, "_blank");
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const handleDownload = async (doc: Document) => {
    setDownloading(doc.id);
    try {
      const result = await getSignedUrl(doc.id);
      if (!result.success) { toast("error", result.error); return; }
      // Fetch as blob to force download regardless of content-type
      const response = await fetch(result.data.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.title ?? doc.storagePath.split("/").pop() ?? "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = (doc: Document) => {
    setDeletingId(doc.id);
    startTransition(async () => {
      try {
        const result = await deleteDocumentAction(doc.id);
        if (!result.success) throw new Error(result.error);
        toast("success", t("deleteSuccess"));
        router.refresh();
      } catch (err) {
        toast("error", (err as Error).message);
      } finally {
        setDeletingId(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {/* Upload button */}
      <div className="flex justify-end p-4 border-b">
        <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("uploadDocument")}
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title={t("noDocuments")}
          description={t("noDocumentsDesc")}
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
              <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title ?? doc.storagePath.split("/").pop()}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={TYPE_VARIANT[doc.type as DocumentType]} className="text-xs">
                    {t(`type${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}` as "typeIntroduction")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                  {doc.byteSize && (
                    <span className="text-xs text-muted-foreground">
                      {(Number(doc.byteSize) / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpen(doc)}
                  disabled={opening === doc.id}
                  title="فتح"
                >
                  {opening === doc.id ? <Spinner className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(doc)}
                  disabled={downloading === doc.id}
                  title={tc("download")}
                >
                  {downloading === doc.id ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id || isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title={tc("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("uploadDocument")}</DialogTitle>
            <DialogClose onClose={() => setUploadOpen(false)} />
          </DialogHeader>
          <DocumentUploadForm
            employeeId={employeeId}
            onSuccess={() => setUploadOpen(false)}
            onCancel={() => setUploadOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
