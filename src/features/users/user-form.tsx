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

// Single schema covering both create and edit — new-user fields are optional on edit
const schema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).optional().or(z.literal("")),
  fullNameAr: z.string().min(1).optional().or(z.literal("")),
  role: z.enum(["super_admin", "site_admin"]),
  siteId: z.string().optional().nullable(),
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
      email: "",
      password: "",
      fullNameAr: user?.fullNameAr ?? "",
      role: (user?.role as "super_admin" | "site_admin") ?? "site_admin",
      siteId: user?.siteId ?? "",
    },
  });

  const role = useWatch({ control, name: "role" });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      let result;
      if (isEdit) {
        result = await updateUserRole(user!.id, {
          role: values.role,
          siteId: values.siteId || null,
        });
      } else {
        result = await createUser({
          email: values.email!,
          password: values.password!,
          fullNameAr: values.fullNameAr!,
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
      {!isEdit && (
        <>
          <FormField label={t("name")} error={errors.fullNameAr?.message} required>
            <Input dir="rtl" {...register("fullNameAr")} />
          </FormField>
          <FormField label={t("email")} error={errors.email?.message} required>
            <Input type="email" dir="ltr" {...register("email")} />
          </FormField>
          <FormField label={t("password")} error={errors.password?.message} required>
            <Input type="password" {...register("password")} />
          </FormField>
        </>
      )}

      <FormField label={t("role")} error={errors.role?.message} required>
        <Select {...register("role")}>
          <option value="site_admin">{t("site_admin")}</option>
          <option value="super_admin">{t("super_admin")}</option>
        </Select>
      </FormField>

      <FormField
        label={t("site")}
        error={errors.siteId?.message}
        required={role === "site_admin"}
      >
        <Select {...register("siteId")}>
          <option value="">{t("selectSite")}</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.nameAr}</option>
          ))}
        </Select>
      </FormField>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" loading={isSubmitting || isPending}>
          {isEdit ? tc("save") : t("addUser")}
        </Button>
      </div>
    </form>
  );
}
