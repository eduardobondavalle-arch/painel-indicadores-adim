import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-[var(--glass)] p-8 text-center backdrop-blur-xl">
      <div>
        <Icon className="mx-auto size-9 text-muted-foreground" />
        <p className="mt-3 font-semibold text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
