"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Pencil, Trash2, UserCircle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteUser } from "@/actions/users";
import { UserForm } from "@/features/users/user-form";
import type { UserListItem } from "@/actions/users";
import type { SiteRow } from "@/features/sites/sites-client";

interface UserProfileClientProps {
  profile: UserListItem;
  sites: SiteRow[];
  currentUserId: string;
}

export function UserProfileClient({ profile, sites, currentUserId }: UserProfileClientProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    const result = await deleteUser(profile.id);
    setDeleting(false);
    if (!result.success) {
      toast("error", result.error === "errors.cannotDeleteSelf" ? t("cannotDeleteSelf") : t("deleteError"));
    } else {
      toast("success", t("deleteSuccess"));
      router.push("/users");
    }
  };

  const fields = [
    { label: t("name"), value: profile.fullNameAr },
    { label: t("email"), value: profile.email },
    { label: t("phone"), value: profile.phone },
    { label: t("site"), value: profile.siteName },
    {
      label: t("createdAt"),
      value: new Date(profile.createdAt).toLocaleDateString("ar-EG", {
        year: "numeric", month: "long", day: "numeric",
      }),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      {/* Back */}
      <Link
        href="/users"
        className="inline-flex items-center gap-2 -ms-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
      >
        <ArrowRight className="h-4 w-4" />
        {t("backToList")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img
              src={(profile as any).avatarUrl}
              alt={profile.fullNameAr ?? ""}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <UserCircle className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{profile.fullNameAr ?? "—"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={profile.role === "super_admin" ? "default" : "secondary"}>
                {t(profile.role as any)}
              </Badge>
              {profile.isActive ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle className="h-3.5 w-3.5" /> {t("active")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> {t("inactive")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            {tc("edit")}
          </Button>
          {profile.id !== currentUserId && (
            <Button
              variant="outline" size="sm"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              {tc("delete")}
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profileInfo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
                <dd className="text-sm font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editUser")}</DialogTitle>
            <DialogClose onClose={() => setEditOpen(false)} />
          </DialogHeader>
          <UserForm
            user={profile}
            sites={sites}
            onSuccess={() => { setEditOpen(false); router.refresh(); }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
