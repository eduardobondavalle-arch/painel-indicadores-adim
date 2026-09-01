import * as React from "react";
import { cn } from "@/lib/utils";

const styles = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  restricted: "bg-purple-100 text-purple-800",
};
export function Badge({ variant = "default", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof styles }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", styles[variant], className)} {...props} />;
}
