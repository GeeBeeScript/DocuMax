"use client";

import { useEffect, useRef } from "react";

export type ShortcutAction =
  "approve" | "reject" | "edit" | "next" | "prev" | "save" | "help" | "leave-field";

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  target: EventTarget | null;
}

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const KEYS: Record<string, ShortcutAction> = {
  a: "approve",
  r: "reject",
  e: "edit",
  j: "next",
  k: "prev",
  "?": "help",
};

/**
 * Key → review action. Single letters work only outside form fields (so typing is never hijacked); Esc leaves a
 * field so they work again; Ctrl/⌘+S saves from anywhere. Held-down keys never repeat a decision.
 */
export function shortcutFor(event: KeyLike): ShortcutAction | null {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") return "save";
  if (isEditable(event.target)) return event.key === "Escape" ? "leave-field" : null;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return null;
  return KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? null;
}

/** Wires `shortcutFor` to the window. Ignored while a dialog is open (it owns the keyboard). */
export function useReviewShortcuts(handlers: Partial<Record<ShortcutAction, () => void>>) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const action = shortcutFor(event);
      if (!action) return;
      if (action === "leave-field") {
        (event.target as HTMLElement).blur();
        return;
      }
      const handler = ref.current[action];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
