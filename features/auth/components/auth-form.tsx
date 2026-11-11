"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pillButtonVariants } from "@/components/brand/pill-button";
import { authContent } from "@/content/auth";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "signup";

/**
 * Login / sign-up form UI. Phase 2 replaces the submit handler with Supabase Auth
 * Server Actions (see docs/phases/02-tenancy.md).
 */
export function AuthForm({ mode, defaultEmail = "" }: { mode: AuthMode; defaultEmail?: string }) {
  const copy = authContent[mode];
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    toast.info(authContent.pendingNotice);
    setPending(false);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" required className="h-12 rounded-xl px-4" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail}
            className="h-12 rounded-xl px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
            className="h-12 rounded-xl px-4"
          />
        </div>
        <button type="submit" disabled={pending} className={cn(pillButtonVariants({ size: "lg" }), "mt-2 w-full")}>
          {copy.submit}
        </button>
        {mode === "signup" && <p className="text-xs text-muted-foreground">{authContent.signup.legal}</p>}
      </form>

      <p className="text-sm text-muted-foreground">
        {copy.alt.prompt}{" "}
        <Link href={copy.alt.link.href} className="font-semibold text-ink underline underline-offset-4">
          {copy.alt.link.label}
        </Link>
      </p>
    </div>
  );
}
