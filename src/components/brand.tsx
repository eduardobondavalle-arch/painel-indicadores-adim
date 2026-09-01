import Image from "next/image";
import { ADIM_LOGO_SRC } from "@/lib/brand/adim-logo";
import { cn } from "@/lib/utils";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      src={ADIM_LOGO_SRC}
      alt="Adim Aluguéis"
      className={cn("w-auto shrink-0 object-contain", compact ? "h-7" : "h-8")}
      width={277}
      height={122}
      unoptimized
      priority
    />
  );
}
