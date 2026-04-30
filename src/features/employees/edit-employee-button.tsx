"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { Employee } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { EmployeeForm } from "@/features/employees/employee-form";
import type { SiteRow } from "@/features/sites/sites-client";

type EmployeeWithRelations = Employee & {
  siteId?: string | null;
  jobTitleId?: string | null;
  firedReason?: string | null;
};

interface EditEmployeeButtonProps {
  employee: EmployeeWithRelations;
  sites: SiteRow[];
  isSuperAdmin: boolean;
  userSiteId: string | null;
}

export function EditEmployeeButton({
  employee,
  sites,
  isSuperAdmin,
  userSiteId,
}: EditEmployeeButtonProps) {
  const t = useTranslations("employees");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
        {t("editEmployee")}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("editEmployee")}</DialogTitle>
            <DialogClose onClose={() => setOpen(false)} />
          </DialogHeader>
          <EmployeeForm
            employee={employee}
            sites={sites}
            isSuperAdmin={isSuperAdmin}
            userSiteId={userSiteId}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
