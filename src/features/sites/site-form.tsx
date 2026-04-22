"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { createSite, updateSite } from "@/actions/sites";
import type { SiteRow } from "@/features/sites/sites-client";

const schema = z.object({
  nameAr: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});
type FormValues = z.infer<typeof schema>;

interface SiteFormProps {
  site?: SiteRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SiteForm({ site, onSuccess, onCancel }: SiteFormProps) {
  const t = useTranslations("sites");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: site
      ? { nameAr: site.nameAr, isActive: site.isActive }
      : { isActive: true },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = site
        ? await updateSite(site.id, values)
        : await createSite(values);
      if (!result.success) {
        toast("error", t("saveError"));
      } else {
        toast("success", site ? t("updateSuccess") : t("createSuccess"));
        router.refresh();
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label={t("nameAr")} error={errors.nameAr?.message} required>
        <Input dir="rtl" {...register("nameAr")} />
      </FormField>
      <FormField label={t("status")}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border" />
          <span className="text-sm">{t("active")}</span>
        </label>
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" loading={isSubmitting || isPending}>
          {site ? tc("save") : t("addSite")}
        </Button>
      </div>
    </form>
  );
}
