"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); setMessage(""); if (password.length < 10) return setError("Use pelo menos 10 caracteres."); if (password !== confirmation) return setError("As senhas não coincidem."); setSaving(true); const { error: updateError } = await createClient().auth.updateUser({ password }); setSaving(false); if (updateError) return setError(updateError.message); setPassword(""); setConfirmation(""); setMessage("Senha atualizada com sucesso."); }
  return <Card><CardHeader><div className="flex items-center gap-2"><KeyRound className="size-5 text-[#d96c12]" /><CardTitle>Alterar senha</CardTitle></div><p className="mt-1 text-sm text-slate-500">Use uma senha longa e exclusiva para este painel.</p></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><div><Label>Nova senha</Label><Input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} /></div><div><Label>Confirmar nova senha</Label><Input type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}<Button disabled={saving}>{saving ? "Atualizando..." : "Atualizar senha"}</Button></form></CardContent></Card>;
}
