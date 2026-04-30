"use client";

import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { getAvatarSignedUrl } from "@/actions/employees";

interface EmployeeAvatarProps {
  /** Storage path stored in avatarUrl column, e.g. "employee/uuid/avatar/photo.jpg" */
  storagePath: string | null | undefined;
  name: string;
  className?: string;
  fallbackClassName?: string;
  fallbackIconClassName?: string;
}

export function EmployeeAvatar({
  storagePath,
  name,
  className = "h-8 w-8 rounded-full object-cover shrink-0",
  fallbackClassName = "h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0",
  fallbackIconClassName = "h-5 w-5 text-muted-foreground",
}: EmployeeAvatarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) return;
    getAvatarSignedUrl(storagePath).then((result) => {
      if (result.success) setSignedUrl(result.data.url);
    });
  }, [storagePath]);

  if (signedUrl) {
    return <img src={signedUrl} alt={name} className={className} />;
  }

  return (
    <div className={fallbackClassName}>
      <UserCircle className={fallbackIconClassName} />
    </div>
  );
}
