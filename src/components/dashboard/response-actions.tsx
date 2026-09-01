"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResponseActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function act(action: "reopen" | "delete") {
    const message = action === "reopen" ? "Justificativa para autorizar a substituição:" : "Justificativa para a exclusão lógica:";
    const justification = window.prompt(message);
    if (!justification) return;
    setLoading(true);
    const response = await fetch(`/api/admin/responses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, justification }) });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) return window.alert(body.error ?? "Ação não realizada.");
    router.refresh();
  }
  return <>{status !== "deleted" && status !== "replaced" && <Button variant="ghost" size="sm" disabled={loading} title="Reabrir e autorizar substituição" onClick={() => act("reopen")}><RotateCcw className="size-4" /></Button>}{status !== "deleted" && <Button variant="ghost" size="sm" disabled={loading} title="Excluir logicamente" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => act("delete")}><Trash2 className="size-4" /></Button>}</>;
}
