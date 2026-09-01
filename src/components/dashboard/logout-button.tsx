"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return <button aria-label="Sair do painel" className="focus-ring press flex h-10 items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={async () => { await createClient().auth.signOut(); router.replace("/gestao"); router.refresh(); }}><LogOut className="size-4" /><span className="hidden 2xl:inline">Sair</span></button>;
}
