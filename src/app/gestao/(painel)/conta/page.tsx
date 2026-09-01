import { requireStaff } from "@/lib/auth";
import { PasswordForm } from "@/components/dashboard/password-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountPage() {
  const { profile } = await requireStaff();
  return <><PageHeader eyebrow="Segurança" title="Minha conta" description="Atualize sua senha administrativa e consulte os dados do seu acesso." /><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Perfil administrativo</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs font-bold uppercase text-slate-400">Nome</p><p className="mt-1 font-bold text-[#102b4e]">{profile.display_name}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">E-mail</p><p className="mt-1 font-bold text-[#102b4e]">{profile.email}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Perfil</p><p className="mt-1 font-bold capitalize text-[#102b4e]">{profile.role}</p></div></CardContent></Card><PasswordForm /></div></>;
}
