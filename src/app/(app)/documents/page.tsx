import { listEmployees } from "@/actions/employees";
import { listDocuments } from "@/actions/documents";
import { DocumentsClient } from "@/features/documents/documents-client";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const params = await searchParams;
  const employeeId = params.employeeId;

  const employeesResult = await listEmployees({ page: 1, pageSize: 50 });
  const employees = employeesResult.success ? employeesResult.data.items : [];

  const documentsResult = employeeId ? await listDocuments(employeeId) : { success: true as const, data: [] };
  const documents = documentsResult.success ? documentsResult.data : [];

  return (
    <DocumentsClient employees={employees} documents={documents} selectedEmployeeId={employeeId ?? null} />
  );
}
