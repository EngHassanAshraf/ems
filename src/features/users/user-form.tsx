"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { createUser, updateUserRole } from "@/actions/users";
import type { UserListItem } from "@/actions/users";
import type { SiteRow } from "@/features/sites/sites-client";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullNameAr: z.string().min(1),
  role: z.enum(["super_admin", "site_admin"]),
  siteId: z.string().optional().nullable(),
});

const editSchema = z.object({
  role: z.enum(["super_admin", "site_admin"]),
  siteId: z.string().optional().nullable(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

interface UserFormProps {
  user?: UserListItem;
  sites: SiteRow[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, sites, onSuccess, onCancel }: UserFormProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEdit = !!user;

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema) as any,
    defaultValues: { role: "site_admin", siteId: "" },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema) as any,
    defaultValues: { role: (user?.role as any) ?? "site_admin", siteId: user?.siteId ?? "" },
  });

  const form = isEdit ? editForm : createForm;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = (values: CreateValues | EditValues) => {
    startTransition(async () => {
      let result;
      if (isEdit) {
        result = await updateUserRole(user!.id, {
          role: (values as EditValues).role,
          siteId: (values as EditValues).siteId || null,
        });
      } else {
        result = await createUser(values as CreateValues);
      }

      if (!result.success) {
        const errKey = result.error === "errors.siteRequired" ? "siteRequired" : "saveError";
        toast("error", t(errKey as any));
      } else {
        toast("success", isEdit ? t("updateSuccess") : t("createSuccess"));
        router.refresh();
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit as any)} className="flex flex-col gap-4">
      {!isEdit && (
        <>
          <FormField label={t("name")} error={(createForm.formState.errors as any).fullNameAr?.message} required>
            <Input dir="rtl" {...createForm.register("fullNameAr")} />
          </FormField>
          <FormField label={t("email")} error={(createForm.formState.errors as any).email?.message} required>
            <Input type="email" dir="ltr" {...createForm.register("email")} />
          </FormField>
          <FormField label={t("password")} error={(createForm.formState.errors as any).password?.message} required>
            <Input type="password" {...createForm.register("password")} />
          </FormField>
        </>
      )}

      <FormField label={t("role")} error={(form.formState.errors as any).role?.message} required>
        <Select {...form.register("role")}>
          <option value="site_admin">{t("site_admin")}</option>
          <option value="super_admin">{t("super_admin")}</option>
        </Select>
      </FormField>

      {/* Site dropdown shown for all roles — required only for site_admin */}
      <FormField
        label={t("site")}
        error={(form.formState.errors as any).siteId?.message}
        required={role === "site_admin"}
      >
        <Select {...form.register("siteId")}>
          <option value="">{t("selectSite")}</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.nameAr}</option>
          ))}
        </Select>
      </FormField>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" loading={isPending}>
          {isEdit ? tc("save") : t("addUser")}
        </Button>
      </div>
    </form>
  );
}
