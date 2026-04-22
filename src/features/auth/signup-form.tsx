"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { signUp } from "@/actions/auth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "8 characters minimum")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});
type FormValues = z.infer<typeof schema>;

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = ({ fullName, email, password }: FormValues) => {
    startTransition(async () => {
      const result = await signUp({ fullName, email, password });
      if (!result.success) {
        const key = result.error.split(".").pop() ?? result.error;
        toast("error", t(key as any) ?? result.error);
      } else {
        toast("success", t("signupSuccess"));
        setTimeout(() => { window.location.href = "/login"; }, 1000);
      }
    });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("signupTitle")}</CardTitle>
        <CardDescription>{t("signupSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField label={t("fullName")} error={errors.fullName?.message} required>
            <Input autoComplete="name" {...register("fullName")} />
          </FormField>

          <FormField label={t("email")} error={errors.email?.message} required>
            <Input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              {...register("email")}
            />
          </FormField>
          <FormField label={t("password")} error={errors.password?.message} required>
            <Input
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </FormField>

          <Button type="submit" loading={isPending} className="w-full mt-2">
            {t("signupButton")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("loginLink")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
