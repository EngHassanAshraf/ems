"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { signIn } from "@/actions/auth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const t = useTranslations("auth");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await signIn(values);
      if (!result.success) {
        const key = result.error.split(".").pop() ?? result.error;
        toast("error", t(key as any) ?? result.error);
      } else {
        window.location.href = result.data.redirectTo;
      }
    });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
              autoComplete="current-password"
              {...register("password")}
            />
          </FormField>
          <Button type="submit" loading={isPending} className="w-full mt-2">
            {t("loginButton")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
