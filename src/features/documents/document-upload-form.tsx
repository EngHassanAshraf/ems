"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Upload, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { uploadDocument } from "@/actions/documents";
import { cn } from "@/lib/utils";

const schema = z.object({
  type: z.enum(["introduction", "contract", "attachment"]),
  title: z.string().optional(),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface DocumentUploadFormProps {
  employeeId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DocumentUploadForm({ employeeId, onSuccess, onCancel }: DocumentUploadFormProps) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "attachment" },
  });

  const onSubmit = (values: FormValues) => {
    if (!selectedFile) { toast("error", t("noFileSelected")); return; }
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("employeeId", employeeId);
      formData.append("type", values.type);
      if (values.title) formData.append("title", values.title);
      if (values.description) formData.append("description", values.description);

      const result = await uploadDocument(formData);
      if (!result.success) {
        const key = result.error.split(".").pop() ?? result.error;
        const msg = key === "uploadFailed" ? t("uploadFailed")
          : key === "invalidInput" ? t("noFileSelected")
          : result.error;
        toast("error", msg);
      } else {
        toast("success", t("uploadSuccess"));
        onSuccess();
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        {selectedFile ? (
          <>
            <FileIcon className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("dropOrClick")}</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t("docType")} error={errors.type?.message} required>
          <Select {...register("type")}>
            <option value="introduction">{t("typeIntroduction")}</option>
            <option value="contract">{t("typeContract")}</option>
            <option value="attachment">{t("typeAttachment")}</option>
          </Select>
        </FormField>
        <FormField label={t("docTitle")} error={errors.title?.message}>
          <Input {...register("title")} placeholder={t("docTitlePlaceholder")} />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" loading={isPending} className="gap-2">
          <Upload className="h-4 w-4" />
          {t("upload")}
        </Button>
      </div>
    </form>
  );
}
