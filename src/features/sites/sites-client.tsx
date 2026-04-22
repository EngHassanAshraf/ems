"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { SiteForm } from "@/features/sites/site-form";
import { deleteSite } from "@/actions/sites";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

// Local type until Prisma generates Site after DB migration
export type SiteRow = {
  id: string;
  nameAr: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

interface SitesClientProps {
  sites: SiteRow[];
}

export function SitesClient({ sites }: SitesClientProps) {
  const t = useTranslations("sites");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SiteRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (s: SiteRow) => { setEditTarget(s); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditTarget(null); };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    setDeletingId(id);
    const result = await deleteSite(id);
    setDeletingId(null);
    if (!result.success) {
      toast("error", t("deleteError"));
    } else {
      toast("success", t("deleteSuccess"));
      router.refresh();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("totalCount", { count: sites.length })}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {t("addSite")}
        </Button>
      </div>

      {sites.length === 0 ? (
        <EmptyState icon={<MapPin className="h-12 w-12" />} title={t("noSites")} description={t("noSitesDesc")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-medium">{t("nameAr")}</th>
                <th className="p-3 text-start font-medium">{t("status")}</th>
                <th className="p-3 text-start font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sites.map((site) => (
                <tr key={site.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{site.nameAr}</td>
                  <td className="p-3">
                    <Badge variant={site.isActive ? "default" : "secondary"}>
                      {site.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(site)} title={tc("edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => handleDelete(site.id)}
                        disabled={deletingId === site.id}
                        title={tc("delete")}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={formOpen} onClose={closeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? t("editSite") : t("addSite")}</DialogTitle>
            <DialogClose onClose={closeForm} />
          </DialogHeader>
          <SiteForm site={editTarget ?? undefined} onSuccess={closeForm} onCancel={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
