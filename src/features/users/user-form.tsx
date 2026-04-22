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
import { createUser, updateUser } from "@/actions/users";
import type { UserListItem } from "@/actions/users";
import type { SiteRow } from "@/features/sites/sites-client";

const schema = z.object({
  fullNameAr: z.string().min(1).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  role: z.enum(["super_admin", "site_admin", "site_security_manager"]),
  siteId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

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

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      fullNameAr: user?.fullNameAr ?? "",
      email: user?.email ?? "",
      password: "",
      phone: user?.phone ?? "",
      role: (user?.role as any) ?? "site_admin",
      siteId: user?.siteId ?? "",
      isActive: user?.isActive ?? true,
    },
  });

  const role = useWatch({ control, name: "role" });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      let result;
      if (isEdit) {
        result = await updateUser(user!.id, {
          fullNameAr: values.fullNameAr || undefined,
          email: values.email || undefined,
          password: values.password || undefined,
          phone: values.phone || null,
          role: values.role,
          siteId: values.siteId || null,
          isActive: values.isActive,
        });
      } else {
        result = await createUser({
          email: values.email!,
          password: values.password!,
          fullNameAr: values.fullNameAr!,
          phone: values.phone || null,
          role: values.role,
          siteId: values.siteId || null,
        });
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label={t("name")} error={errors.fullNameAr?.message} required={!isEdit}>
        <Input dir="rtl" {...register("fullNameAr")} />
      </FormField>

      <FormField label={t("email")} error={errors.email?.message} required={!isEdit}>
        <Input type="email" dir="ltr" {...register("email")} />
      </FormField>

      <FormField
        label={isEdit ? t("newPassword") : t("password")}
        error={errors.password?.message}
        required={!isEdit}
      >
        <Input
          type="password"
          placeholder={isEdit ? t("passwordPlaceholder") : undefined}
          {...register("password")}
        />
      </FormField>

      <FormField label={t("phone")} error={errors.phone?.message}>
        <Input type="tel" {...register("phone")} />
      </FormField>

      <FormField label={t("role")} error={errors.role?.message} required>
        <Select {...register("role")}>
          <option value="site_admin">{t("site_admin")}</option>
          <option value="site_security_manager">{t("site_security_manager")}</option>
          <option value="super_admin">{t("super_admin")}</option>
        </Select>
      </FormField>

      <FormField
        label={t("site")}
        error={errors.siteId?.message}
        required={role === "site_admin" || role === "site_security_manager"}
      >
        <Select {...register("siteId")}>
          <option value="">{t("selectSite")}</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.nameAr}</option>
          ))}
        </Select>
      </FormField>

      {isEdit && (
        <FormField label={t("status")}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border" />
            <span className="text-sm">{t("active")}</span>
          </label>
        </FormField>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" loading={isSubmitting || isPending}>
          {isEdit ? tc("save") : t("addUser")}
        </Button>
      </div>
    </form>
  );
}
