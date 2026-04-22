"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import type { Employee } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { EmployeesTable } from "@/features/employees/employees-table";
import { EmployeeForm } from "@/features/employees/employee-form";
import { DeleteEmployeeDialog } from "@/features/employees/delete-employee-dialog";
import type { SiteRow } from "@/features/sites/sites-client";
import type { JobTitleRow } from "@/actions/job-titles";

type EmployeeWithSite = Employee & { site: { nameAr: string } | null; jobTitle: { nameAr: string } | null };

interface EmployeesClientProps {
  employees: EmployeeWithSite[];
  total: number;
  sites: SiteRow[];
  jobTitles: JobTitleRow[];
  isSuperAdmin: boolean;
  userSiteId: string | null;
  initialQ: string;
  initialStatus: string;
  initialSiteId: string;
  initialJobTitleId: string;
  initialPage: number;
  pageSize: number;
}

export function EmployeesClient({
  employees, total, sites, jobTitles, isSuperAdmin, userSiteId,
  initialQ, initialStatus, initialSiteId, initialJobTitleId, initialPage, pageSize,
}: EmployeesClientProps) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeWithSite | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithSite | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  function updateParams(updates: { q?: string; status?: string; siteId?: string; jobTitleId?: string; page?: number }) {
    const params = new URLSearchParams();
    const q = updates.q ?? initialQ;
    const status = updates.status ?? initialStatus;
    const siteId = updates.siteId ?? initialSiteId;
    const jobTitleId = updates.jobTitleId ?? initialJobTitleId;
    const page = updates.page ?? initialPage;
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);
    if (siteId && siteId !== "all") params.set("siteId", siteId);
    if (jobTitleId && jobTitleId !== "all") params.set("jobTitleId", jobTitleId);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(`/employees${qs ? `?${qs}` : ""}`);
  }

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (e: EmployeeWithSite) => { setEditTarget(e); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditTarget(null); };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("totalCount", { count: total })}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {t("addEmployee")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            defaultValue={initialQ}
            onChange={(e) => updateParams({ q: e.target.value, page: 1 })}
            placeholder={tc("search")}
          />
        </div>
        <Select
          className="w-full sm:w-40"
          defaultValue={initialStatus}
          onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
        >
          <option value="all">{t("allStatuses")}</option>
          <option value="active">{t("statusActive")}</option>
          <option value="fired">{t("statusFired")}</option>
        </Select>
        {/* site filter only for super_admin */}
        {isSuperAdmin && (
          <Select
            className="w-full sm:w-48"
            defaultValue={initialSiteId}
            onChange={(e) => updateParams({ siteId: e.target.value, page: 1 })}
          >
            <option value="all">{t("allSites")}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.nameAr}</option>
            ))}
          </Select>
        )}
        <Select
          className="w-full sm:w-48"
          defaultValue={initialJobTitleId}
          onChange={(e) => updateParams({ jobTitleId: e.target.value, page: 1 })}
        >
          <option value="all">{t("allJobTitles")}</option>
          {jobTitles.map((j) => (
            <option key={j.id} value={j.id}>{j.nameAr}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <EmployeesTable
        employees={employees}
        isSuperAdmin={isSuperAdmin}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onView={(e) => router.push(`/employees/${e.id}`)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={initialPage <= 1}
            onClick={() => updateParams({ page: initialPage - 1 })}>{tc("prev")}</Button>
          <span className="text-sm text-muted-foreground">{initialPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={initialPage >= totalPages}
            onClick={() => updateParams({ page: initialPage + 1 })}>{tc("next")}</Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onClose={closeForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? t("editEmployee") : t("addEmployee")}</DialogTitle>
            <DialogClose onClose={closeForm} />
          </DialogHeader>
          <EmployeeForm
            employee={editTarget ?? undefined}
            sites={sites}
            isSuperAdmin={isSuperAdmin}
            userSiteId={userSiteId}
            onSuccess={closeForm}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>

      <DeleteEmployeeDialog employee={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
