import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "@/styles/globals.css";
import { ThemeProvider } from "@/lib/theme/provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "إدارة الموظفين",
  description: "نظام إدارة الموظفين والمستندات",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="ar" dir="rtl">
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
