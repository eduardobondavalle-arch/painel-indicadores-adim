import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("focus-ring flex h-10 w-full rounded-xl border border-input bg-card/85 px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  ),
);
Input.displayName = "Input";
