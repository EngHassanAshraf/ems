import { EmployeeAvatar } from "@/features/employees/employee-avatar";

interface EmployeeEvalCardProps {
  nameAr: string;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  site?: string | null;
  hireDate?: Date | string | null;
}

export function EmployeeEvalCard({
  nameAr,
  avatarUrl,
  employeeCode,
  jobTitle,
  site,
  hireDate,
}: EmployeeEvalCardProps) {
  const hireDateStr = hireDate
    ? new Date(hireDate).toLocaleDateString("ar-EG")
    : null;

  return (
    <div className="flex flex-row-reverse items-center gap-5 rounded-xl border bg-card p-4 w-full">
      {/* Avatar — visual right */}
      <div className="shrink-0">
        <EmployeeAvatar
          storagePath={avatarUrl}
          name={nameAr}
          className="h-[150px] w-[150px] object-cover border-2 border-border shadow-sm"
          fallbackClassName="h-28 w-28 rounded-full bg-muted flex items-center justify-center border-2 border-border shadow-sm"
          fallbackIconClassName="h-16 w-16 text-muted-foreground"
        />
      </div>

      {/* Details — visual left */}
      <dl className="flex-1 grid grid-cols-1 gap-y-2 sm:grid-cols-2 text-sm" dir="rtl">
        <div className="sm:col-span-2">
          <dd className="text-xl font-bold leading-tight">{nameAr}</dd>
        </div>
        {jobTitle && (
          <div>
            <dt className="text-xs text-muted-foreground">المسمى الوظيفي</dt>
            <dd className="font-medium">{jobTitle}</dd>
          </div>
        )}
        {site && (
          <div>
            <dt className="text-xs text-muted-foreground">الموقع</dt>
            <dd className="font-medium">{site}</dd>
          </div>
        )}
        {hireDateStr && (
          <div>
            <dt className="text-xs text-muted-foreground">تاريخ التعيين</dt>
            <dd className="font-medium">{hireDateStr}</dd>
          </div>
        )}
        {employeeCode && (
          <div>
            <dt className="text-xs text-muted-foreground">الكود</dt>
            <dd className="font-medium">{employeeCode}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
