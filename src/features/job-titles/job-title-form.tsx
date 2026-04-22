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
import { createJobTitle, updateJobTitle } from "@/actions/job-titles";
import type { JobTitleRow } from "@/actions/job-titles";

const schema = z.object({
  nameAr: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});
type FormValues = z.infer<typeof schema>;

interface JobTitleFormProps {
  jobTitle?: JobTitleRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function JobTitleForm({ jobTitle, onSuccess, onCancel }: JobTitleFormProps) {
  const t = useTranslations("jobTitles");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: jobTitle
      ? { nameAr: jobTitle.nameAr, isActive: jobTitle.isActive }
      : { isActive: true },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = jobTitle
        ? await updateJobTitle(jobTitle.id, values)
        : await createJobTitle(values);
      if (!result.success) {
        toast("error", t("saveError"));
      } else {
        toast("success", jobTitle ? t("updateSuccess") : t("createSuccess"));
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
          {jobTitle ? tc("save") : t("addJobTitle")}
        </Button>
      </div>
    </form>
  );
}
