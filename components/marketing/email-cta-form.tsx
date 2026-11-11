"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { pillButtonVariants } from "@/components/brand/pill-button";
import { cn } from "@/lib/utils";

export type EmailCtaFormProps = {
  label: string;
  placeholder: string;
  /** Where to continue sign-up; the email is passed as ?email=. */
  action?: string;
  tone?: "light" | "dark";
  className?: string;
};

/** Hero-style "email + Sign up" field. Hands off to the sign-up page with the email prefilled. */
export function EmailCtaForm({
  label,
  placeholder,
  action = "/signup",
  tone = "light",
  className,
}: EmailCtaFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    router.push(`${action}${q}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex w-full max-w-lg flex-col gap-2 rounded-3xl p-1.5 sm:flex-row sm:rounded-full",
        tone === "light" ? "border border-gray-300 bg-paper shadow-card" : "bg-paper/10",
        className,
      )}
    >
      <label htmlFor="cta-email" className="sr-only">
        Work email
      </label>
      <input
        id="cta-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-base outline-none placeholder:text-gray-500",
          tone === "dark" && "text-paper placeholder:text-paper/60",
        )}
      />
      <button
        type="submit"
        className={pillButtonVariants({ variant: tone === "light" ? "primary" : "yellow", size: "md" })}
      >
        {label}
      </button>
    </form>
  );
}
