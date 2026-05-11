"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useToast } from "./use-toast";
import { cn } from "../lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "relative flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5",
            t.variant === "destructive"
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-border bg-background text-foreground",
          )}
        >
          <div className="flex-1 space-y-0.5">
            {t.title && <p className="text-sm font-semibold">{t.title}</p>}
            {t.description && <p className="text-sm opacity-90">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
