"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/text-field";
import { pillButtonVariants } from "@/components/brand/pill-button";
import { authContent } from "@/content/auth";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils";
import { logIn, sendMagicLink, signUp } from "../actions";
import { LogInSchema, MagicLinkSchema, SignUpSchema } from "../schema";

export type AuthMode = "login" | "signup";
type Method = "password" | "magic";

interface Values {
  fullName?: string;
  email: string;
  password?: string;
  next?: string;
}

/** Login / sign-up form. Same zod schemas on the client (react-hook-form) and in the Server Actions. */
export function AuthForm({
  mode,
  defaultEmail = "",
  next,
  linkError = false,
}: {
  mode: AuthMode;
  defaultEmail?: string;
  next?: string;
  linkError?: boolean;
}) {
  const copy = authContent[mode];
  const [method, setMethod] = useState<Method>("password");
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; text: string } | null>(
    linkError ? { tone: "danger", text: authContent.linkError } : null,
  );
  const [pending, startTransition] = useTransition();

  // The schema depends on mode + method; one stable resolver reads the current one.
  const schema = useRef(SignUpSchema as typeof SignUpSchema | typeof LogInSchema | typeof MagicLinkSchema);
  schema.current = mode === "signup" ? SignUpSchema : method === "magic" ? MagicLinkSchema : LogInSchema;
  const resolver: Resolver<Values> = (values, context, options) =>
    (zodResolver(schema.current) as unknown as Resolver<Values>)(values, context, options);
  const form = useForm<Values>({ resolver, defaultValues: { email: defaultEmail, next } });
  const { errors } = form.formState;

  function apply(result: ActionResult<unknown>) {
    if (!result.ok) {
      setNotice({ tone: "danger", text: result.error });
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof Values, { message: messages[0] });
      }
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setNotice(null);
    startTransition(async () => {
      if (mode === "signup") {
        const result = await signUp(values);
        if (result?.ok) setNotice({ tone: "success", text: authContent.confirmEmail });
        else if (result) apply(result);
      } else if (method === "magic") {
        const result = await sendMagicLink(values);
        if (result.ok) setNotice({ tone: "success", text: authContent.magicLink.sent });
        else apply(result);
      } else {
        const result = await logIn(values);
        if (result) apply(result); // success redirects
      }
    });
  });

  const altHref = next ? `${copy.alt.link.href}?next=${encodeURIComponent(next)}` : copy.alt.link.href;

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {notice && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
        {mode === "signup" && (
          <TextField
            id="fullName"
            label="Full name"
            size="lg"
            autoComplete="name"
            error={errors.fullName?.message}
            {...form.register("fullName")}
          />
        )}
        <TextField
          id="email"
          label="Work email"
          type="email"
          size="lg"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register("email")}
        />
        {method === "password" && (
          <TextField
            id="password"
            label="Password"
            type="password"
            size="lg"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            hint={mode === "signup" ? "At least 8 characters." : undefined}
            error={errors.password?.message}
            {...form.register("password")}
          />
        )}
        <button
          type="submit"
          disabled={pending}
          className={cn(pillButtonVariants({ size: "lg" }), "mt-2 w-full")}
        >
          {method === "magic" ? authContent.magicLink.submit : copy.submit}
        </button>
        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              form.clearErrors();
              setMethod(method === "password" ? "magic" : "password");
            }}
            className="text-sm font-semibold text-ink underline underline-offset-4"
          >
            {method === "password" ? authContent.magicLink.toggle : authContent.magicLink.togglePassword}
          </button>
        )}
        {mode === "signup" && <p className="text-xs text-muted-foreground">{authContent.signup.legal}</p>}
      </form>

      <p className="text-sm text-muted-foreground">
        {copy.alt.prompt}{" "}
        <Link href={altHref} className="font-semibold text-ink underline underline-offset-4">
          {copy.alt.link.label}
        </Link>
      </p>
    </div>
  );
}
