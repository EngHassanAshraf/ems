"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { createEvaluation, updateEvaluation, getEvaluationById } from "@/actions/evaluations";
import type { EvaluationCriteria } from "@prisma/client";
import type { EvaluationWithItems } from "@/actions/evaluations";

interface EvaluationFormProps {
  employee: {
    id: string;
    nameAr: string;
    siteId: string | null;
    site: { nameAr: string } | null;
  };
  criteria: EvaluationCriteria[];
  existingEvaluation: EvaluationWithItems | null;
  canEdit: boolean;
  /** When provided, called with the saved evaluation instead of navigating away. */
  onSuccess?: (evaluation: EvaluationWithItems) => void;
}

type ScoreValue = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "";

interface CriterionState {
  score: ScoreValue;
  notes: string;
}

function buildInitialState(
  criteria: EvaluationCriteria[],
  existingEvaluation: EvaluationWithItems | null
): Record<string, CriterionState> {
  const state: Record<string, CriterionState> = {};
  for (const criterion of criteria) {
    const existingItem = existingEvaluation?.items.find(
      (item) => item.criteriaId === criterion.id
    );
    state[criterion.id] = {
      score: (existingItem?.score as ScoreValue) ?? "",
      notes: existingItem?.notes ?? "",
    };
  }
  return state;
}

export function EvaluationForm({
  employee,
  criteria,
  existingEvaluation,
  canEdit,
  onSuccess,
}: EvaluationFormProps) {
  const t = useTranslations("evaluations");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [criteriaState, setCriteriaState] = useState<Record<string, CriterionState>>(
    () => buildInitialState(criteria, existingEvaluation)
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Score options built from translation keys
  const scoreOptions = [
    { value: "" as const, label: t("selectScore") },
    { value: "EXCELLENT" as const, label: t("scoreExcellent") },
    { value: "VERY_GOOD" as const, label: t("scoreVeryGood") },
    { value: "GOOD" as const, label: t("scoreGood") },
    { value: "ACCEPTABLE" as const, label: t("scoreAcceptable") },
  ];

  const handleScoreChange = (criteriaId: string, value: ScoreValue) => {
    setCriteriaState((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], score: value },
    }));
    if (submitted && value) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[criteriaId];
        return next;
      });
    }
  };

  const handleNotesChange = (criteriaId: string, value: string) => {
    setCriteriaState((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], notes: value },
    }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    for (const criterion of criteria) {
      if (!criteriaState[criterion.id]?.score) {
        errors[criterion.id] = t("scoreRequired");
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!validate()) {
      return;
    }

    const items = criteria.map((criterion) => ({
      criteriaId: criterion.id,
      score: criteriaState[criterion.id].score as Exclude<ScoreValue, "">,
      notes: criteriaState[criterion.id].notes || null,
    }));

    startTransition(async () => {
      const payload = {
        employeeId: employee.id,
        items,
      };

      const result = existingEvaluation
        ? await updateEvaluation(existingEvaluation.id, payload)
        : await createEvaluation(payload);

      if (!result.success) {
        toast("error", result.error);
      } else if (onSuccess) {
        // Fetch the full evaluation with nested items before calling onSuccess
        const full = await getEvaluationById(result.data.id);
        if (full.success) {
          onSuccess(full.data);
        } else {
          toast("error", full.error);
        }
      } else {
        router.push(`/employees/${employee.id}/evaluations/${result.data.id}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Criteria grid — 1 col on mobile, 2 on md, 3 on lg */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {criteria.map((criterion, index) => {
          const state = criteriaState[criterion.id] ?? { score: "", notes: "" };
          const error = validationErrors[criterion.id];

          return (
            <div
              key={criterion.id}
              className="rounded-lg border bg-card p-4 flex flex-col gap-3"
            >
              {/* Criterion title */}
              <p className="text-sm font-semibold leading-snug" dir="rtl">
                {index+1}. {criterion.titleAr}
              </p>

              {/* Score select */}
              <FormField label={t("scoreLabel")} error={error} required>
                {canEdit ? (
                  <Select
                    value={state.score}
                    onChange={(e) =>
                      handleScoreChange(criterion.id, e.target.value as ScoreValue)
                    }
                    aria-invalid={!!error}
                  >
                    {scoreOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {scoreOptions.find((o) => o.value === state.score)?.label ?? "—"}
                  </div>
                )}
              </FormField>

              {/* Notes textarea */}
              <FormField label={t("notesLabel")}>
                {canEdit ? (
                  <Textarea
                    dir="rtl"
                    rows={2}
                    value={state.notes}
                    onChange={(e) => handleNotesChange(criterion.id, e.target.value)}
                    placeholder={t("notesPlaceholder")}
                  />
                ) : (
                  <div
                    className="min-h-[60px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                    dir="rtl"
                  >
                    {state.notes || "—"}
                  </div>
                )}
              </FormField>
            </div>
          );
        })}
      </div>

      {/* Submit button — hidden in read-only mode */}
      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={isPending}>
            {existingEvaluation ? t("submitUpdate") : t("submitCreate")}
          </Button>
        </div>
      )}
    </form>
  );
}
