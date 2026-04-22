"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { FileText, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentsList } from "@/features/documents/documents-list";
import { cn } from "@/lib/utils";
import type { Employee } from "@prisma/client";
import type { Document } from "@prisma/client";

interface DocumentsClientProps {
  employees: Employee[];
  documents: Document[];
  selectedEmployeeId: string | null;
}

export function DocumentsClient({
  employees,
  documents,
  selectedEmployeeId,
}: DocumentsClientProps) {
  const t = useTranslations("documents");
  const te = useTranslations("employees");
  const tc = useTranslations("common");
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? employees.filter(
        (emp) =>
          emp.nameAr.toLowerCase().includes(q.toLowerCase()) ||
          (emp.email ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : employees;

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  const handleSelectEmployee = (id: string) => {
    router.push(`/documents?employeeId=${id}`);
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Employee sidebar */}
      <div className="w-full md:w-72 border-e flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold mb-3">{t("title")}</h1>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tc("search")}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} title={te("noEmployees")} className="py-8" />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((emp) => (
                <li key={emp.id}>
                  <button
                    onClick={() => handleSelectEmployee(emp.id)}
                    className={cn(
                      "w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors",
                      selectedEmployeeId === emp.id && "bg-primary/10 text-primary"
                    )}
                  >
                    <p className="text-sm font-medium">{emp.nameAr}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Documents panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedEmployeeId ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title={t("selectEmployee")}
            description={t("selectEmployeeDesc")}
            className="h-full"
          />
        ) : (
          <div>
            <div className="p-4 border-b">
              <h2 className="font-semibold">{selectedEmployee?.nameAr}</h2>
              <p className="text-sm text-muted-foreground">{selectedEmployee?.email}</p>
            </div>
            <DocumentsList
              employeeId={selectedEmployeeId}
              companyId=""
              documents={documents}
              isLoading={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
