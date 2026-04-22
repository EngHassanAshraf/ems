import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeStatusBadge } from "@/features/employees/employee-status-badge";
import { DocumentsList } from "@/features/documents/documents-list";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("employees");
  const td = await getTranslations("documents");

  const employee = await (prisma as any).employee.findUnique({
    where: { id },
    include: {
      documents: true,
      site: { select: { nameAr: true } },
      jobTitle: { select: { nameAr: true } },
    },
  });

  if (!employee) notFound();

  const fields = [
    { label: t("nameAr"), value: employee.nameAr },
    { label: t("jobTitle"), value: employee.jobTitle?.nameAr ?? null },
    { label: t("site"), value: employee.site?.nameAr ?? null },
    { label: t("email"), value: employee.email },
    { label: t("phone"), value: employee.phone },
    { label: t("address"), value: employee.address },
    { label: t("hireDate"), value: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString("ar-EG") : null },
    ...(employee.status === "fired" && employee.firedReason
      ? [{ label: t("firedReason"), value: employee.firedReason }]
      : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <Link href="/employees" className="inline-flex items-center gap-2 -ms-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent">
        <ArrowRight className="h-4 w-4" />
        {t("backToList")}
      </Link>

      <div className="flex items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{employee.nameAr}</h1>
          <div className="mt-2"><EmployeeStatusBadge status={employee.status} /></div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("personalInfo")}</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
                <dd className="text-sm font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{td("title")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DocumentsList employeeId={id} companyId="" documents={employee.documents} isLoading={false} />
        </CardContent>
      </Card>
    </div>
  );
}
