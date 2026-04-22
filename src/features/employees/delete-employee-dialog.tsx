"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteEmployee } from "@/actions/employees";
import type { Employee } from "@prisma/client";

interface DeleteEmployeeDialogProps {
  employee: Employee | null;
  onClose: () => void;
}

export function DeleteEmployeeDialog({ employee, onClose }: DeleteEmployeeDialogProps) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteEmployee(employee!.id);
      if (!result.success) {
        toast("error", t(result.error));
      } else {
        toast("success", t("deleteSuccess"));
        onClose();
      }
    });
  };

  return (
    <Dialog open={!!employee} onClose={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogClose onClose={onClose} />
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-6">
          {t("deleteConfirm", { name: employee?.nameAr ?? "" })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            variant="destructive"
            loading={isPending}
            onClick={handleDelete}
          >
            {tc("delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
