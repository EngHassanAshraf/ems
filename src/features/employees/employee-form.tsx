"use client";

import { useTransition, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { createEmployee, updateEmployee } from "@/actions/employees";
import { listJobTitles } from "@/actions/job-titles";
import type { Employee } from "@prisma/client";
import type { SiteRow } from "@/features/sites/sites-client";
import type { JobTitleRow } from "@/actions/job-titles";
import { Textarea } from "@/components/ui/textarea";

const schema = z
  .object({
    nameAr: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    hireDate: z.string().optional().nullable(),
    status: z.enum(["active", "fired"]),
    firedReason: z.string().optional().nullable(),
    siteId: z.string().optional().nullable(),
    jobTitleId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "active" && !data.siteId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["siteId"], message: "required_for_active" });
    }
    if (!data.jobTitleId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["jobTitleId"], message: "required" });
    }
    if (data.status === "fired" && !data.firedReason?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["firedReason"], message: "required" });
    }
  });

type FormValues = z.infer<typeof schema>;

interface EmployeeFormProps {
  employee?: Employee & { siteId?: string | null; jobTitleId?: string | null; firedReason?: string | null };
  sites: SiteRow[];
  isSuperAdmin: boolean;
  userSiteId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmployeeForm({ employee, sites, isSuperAdmin, userSiteId, onSuccess, onCancel }: EmployeeFormProps) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [jobTitles, setJobTitles] = useState<JobTitleRow[]>([]);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: employee
      ? {
          nameAr: employee.nameAr,
          email: employee.email ?? "",
          phone: employee.phone ?? "",
          address: employee.address ?? "",
          hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split("T")[0] : "",
          status: employee.status,
          firedReason: employee.firedReason ?? "",
          siteId: employee.siteId ?? "",
          jobTitleId: employee.jobTitleId ?? "",
        }
      : {
          status: "active" as const,
          firedReason: "",
          siteId: !isSuperAdmin && userSiteId ? userSiteId : "",
          jobTitleId: "",
        },
  });

  useEffect(() => {
    listJobTitles().then((r) => {
      if (r.success) {
        setJobTitles(r.data);
        // Re-apply defaultValues after options load so the select shows the correct value
        if (employee) {
          reset({
            nameAr: employee.nameAr,
            email: employee.email ?? "",
            phone: employee.phone ?? "",
            address: employee.address ?? "",
            hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split("T")[0] : "",
            status: employee.status,
            firedReason: employee.firedReason ?? "",
            siteId: employee.siteId ?? "",
            jobTitleId: employee.jobTitleId ?? "",
          });
        }
      }
    });
  }, [employee, reset]);

  const status = useWatch({ control, name: "status" });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const clean = {
        ...values,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        hireDate: values.hireDate || null,
        firedReason: values.status === "fired" ? (values.firedReason || null) : null,
        siteId: values.siteId || null,
        jobTitleId: values.jobTitleId || null,
      };
      const result = employee
        ? await updateEmployee(employee.id, clean)
        : await createEmployee(clean);
      if (!result.success) {
        toast("error", t(result.error as any));
      } else {
        toast("success", employee ? t("updateSuccess") : t("createSuccess"));
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t("nameAr")} error={errors.nameAr?.message} required>
          <Input dir="rtl" {...register("nameAr")} />
        </FormField>
        <FormField label={t("email")} error={errors.email?.message}>
          <Input type="email" dir="ltr" {...register("email")} />
        </FormField>
        <FormField label={t("phone")} error={errors.phone?.message}>
          <Input type="tel" {...register("phone")} />
        </FormField>
        <FormField label={t("hireDate")} error={errors.hireDate?.message}>
          <Input type="date" dir="ltr" {...register("hireDate")} />
        </FormField>
        <FormField label={t("status")} error={errors.status?.message} required>
          <Select {...register("status")}>
            <option value="active">{t("statusActive")}</option>
            <option value="fired">{t("statusFired")}</option>
          </Select>
        </FormField>
        <FormField
          label={t("jobTitle")}
          error={errors.jobTitleId?.message === "required" ? t("jobTitleRequired") : errors.jobTitleId?.message}
          required
        >
          <Select {...register("jobTitleId")} disabled={jobTitles.length === 0}>
            <option value="">{t("selectJobTitle")}</option>
            {jobTitles.map((j) => (
              <option key={j.id} value={j.id}>{j.nameAr}</option>
            ))}
          </Select>
        </FormField>

        {isSuperAdmin ? (
          <FormField
            label={t("site")}
            error={errors.siteId?.message === "required_for_active" ? t("siteRequired") : errors.siteId?.message}
            required={status === "active"}
          >
            <Select {...register("siteId")} disabled={sites.length === 0}>
              <option value="">{t("selectSite")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.nameAr}</option>
              ))}
            </Select>
          </FormField>
        ) : (
          <FormField label={t("site")}>
            <Input value={sites.find((s) => s.id === userSiteId)?.nameAr ?? "—"} disabled readOnly />
            <input type="hidden" {...register("siteId")} value={userSiteId ?? ""} />
          </FormField>
        )}
      </div>

      {status === "fired" && (
        <FormField
          label={t("firedReason")}
          error={errors.firedReason?.message === "required" ? t("firedReasonRequired") : errors.firedReason?.message}
          required
        >
          <Textarea
            dir="rtl"
            rows={3}
            placeholder={t("firedReasonPlaceholder")}
            {...register("firedReason")}
          />
        </FormField>
      )}

      <FormField label={t("address")} error={errors.address?.message}>
        <Input {...register("address")} />
      </FormField>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" loading={isSubmitting || isPending}>
          {employee ? tc("save") : t("createEmployee")}
        </Button>
      </div>
    </form>
  );
}
