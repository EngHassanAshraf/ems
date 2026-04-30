"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Pencil, PowerOff, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { createCriteria, updateCriteria } from "@/actions/evaluations";
import type { EvaluationCriteria } from "@prisma/client";

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const criteriaFormSchema = z.object({
  titleAr: z.string().min(1, "العنوان مطلوب"),
  descriptionAr: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

type CriteriaFormValues = z.infer<typeof criteriaFormSchema>;

// ---------------------------------------------------------------------------
// Inner form component
// ---------------------------------------------------------------------------

interface CriteriaFormProps {
  criteria?: EvaluationCriteria;
  onSuccess: () => void;
  onCancel: () => void;
}

function CriteriaForm({ criteria, onSuccess, onCancel }: CriteriaFormProps) {
  const t = useTranslations("criteria");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CriteriaFormValues>({
    resolver: zodResolver(criteriaFormSchema) as any,
    defaultValues: criteria
      ? {
          titleAr: criteria.titleAr,
          descriptionAr: criteria.descriptionAr ?? "",
          isActive: criteria.isActive,
        }
      : { isActive: true },
  });

  const onSubmit = (values: CriteriaFormValues) => {
    startTransition(async () => {
      const result = criteria
        ? await updateCriteria(criteria.id, values)
        : await createCriteria(values);

      if (!result.success) {
        toast("error", t("saveError"));
      } else {
        toast("success", criteria ? t("updateSuccess") : t("createSuccess"));
        router.refresh();
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label={t("titleAr")} error={errors.titleAr?.message} required>
        <Input dir="rtl" {...register("titleAr")} />
      </FormField>

      <FormField label={t("descriptionAr")} error={errors.descriptionAr?.message}>
        <Textarea dir="rtl" rows={3} {...register("descriptionAr")} />
      </FormField>

      {/* Only show isActive toggle when editing */}
      {criteria && (
        <FormField label={t("status")}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("isActive")}
              className="h-4 w-4 rounded border"
            />
            <span className="text-sm">{t("active")}</span>
          </label>
        </FormField>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting || isPending}>
          {criteria ? tc("save") : t("addCriteria")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface CriteriaClientProps {
  criteria: EvaluationCriteria[];
}

export function CriteriaClient({ criteria }: CriteriaClientProps) {
  const t = useTranslations("criteria");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EvaluationCriteria | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (c: EvaluationCriteria) => {
    setEditTarget(c);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  const handleDeactivate = async (c: EvaluationCriteria) => {
    if (!confirm(t("deactivateConfirm"))) return;
    setDeactivatingId(c.id);
    const result = await updateCriteria(c.id, { isActive: false });
    setDeactivatingId(null);
    if (!result.success) {
      toast("error", t("deactivateError"));
    } else {
      toast("success", t("deactivateSuccess"));
      router.refresh();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("totalCount", { count: criteria.length })}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {t("addCriteria")}
        </Button>
      </div>

      {/* List */}
      {criteria.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12" />}
          title={t("noCriteria")}
          description={t("noCriteriaDesc")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-medium">{t("titleAr")}</th>
                <th className="p-3 text-start font-medium">{t("descriptionAr")}</th>
                <th className="p-3 text-start font-medium">{t("status")}</th>
                <th className="p-3 text-start font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {criteria.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium" dir="rtl">
                    {c.titleAr}
                  </td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate" dir="rtl">
                    {c.descriptionAr ?? "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant={c.isActive ? "success" : "secondary"}>
                      {c.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        title={tc("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {c.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(c)}
                          disabled={deactivatingId === c.id}
                          title={t("deactivate")}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                        >
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onClose={closeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? t("editCriteria") : t("addCriteria")}
            </DialogTitle>
            <DialogClose onClose={closeForm} />
          </DialogHeader>
          <CriteriaForm
            criteria={editTarget ?? undefined}
            onSuccess={closeForm}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
