"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { deleteUser } from "@/actions/users";
import { UserForm } from "@/features/users/user-form";
import type { UserListItem } from "@/actions/users";
import type { SiteRow } from "@/features/sites/sites-client";

interface UsersClientProps {
  users: UserListItem[];
  sites: SiteRow[];
  currentUserId: string;
}

export function UsersClient({ users, sites, currentUserId }: UsersClientProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (u: UserListItem) => { setEditTarget(u); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditTarget(null); };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    setDeletingId(id);
    const result = await deleteUser(id);
    setDeletingId(null);
    if (!result.success) {
      toast("error", result.error === "errors.cannotDeleteSelf" ? t("cannotDeleteSelf") : t("deleteError"));
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
          <p className="text-sm text-muted-foreground mt-0.5">{t("totalCount", { count: users.length })}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {t("addUser")}
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={<Users className="h-12 w-12" />} title={t("noUsers")} description={t("noUsersDesc")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-medium">{t("name")}</th>
                <th className="p-3 text-start font-medium">{t("email")}</th>
                <th className="p-3 text-start font-medium">{t("role")}</th>
                <th className="p-3 text-start font-medium hidden sm:table-cell">{t("site")}</th>
                <th className="p-3 text-start font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{u.fullNameAr ?? "—"}</td>
                  <td className="p-3 text-muted-foreground dir-ltr">{u.email}</td>
                  <td className="p-3">
                    <Badge variant={u.role === "super_admin" ? "default" : "secondary"}>
                      {t(u.role as any)}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">
                    {u.siteName ?? "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title={tc("edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id || u.id === currentUserId}
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
            <DialogTitle>{editTarget ? t("editUser") : t("addUser")}</DialogTitle>
            <DialogClose onClose={closeForm} />
          </DialogHeader>
          <UserForm user={editTarget ?? undefined} sites={sites} onSuccess={closeForm} onCancel={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
