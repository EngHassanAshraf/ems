"use client";
export default function DocumentsError({ error, reset }: { error: Error; reset: () => void }) {
  return <div className="flex flex-col items-center justify-center p-8 gap-4"><p className="text-destructive">{error.message}</p><button onClick={reset} className="text-primary underline">Retry</button></div>;
}
