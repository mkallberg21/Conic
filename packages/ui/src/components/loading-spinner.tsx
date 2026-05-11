import * as React from "react";
import { cn } from "../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<string, string> = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-primary",
        SIZE[size],
        className,
      )}
      aria-label="Loading"
    />
  );
}
