import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn("focus-ring h-10 w-full rounded-xl border border-input bg-card/85 px-3 text-sm text-foreground shadow-sm hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  ),
);
Select.displayName = "Select";
