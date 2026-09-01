import { ShieldX } from "lucide-react";
import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";

export default function SemAcessoPage() {
  return <main className="grid min-h-screen place-items-center p-6"><Card className="max-w-lg"><CardContent className="p-8 text-center"><div className="mb-8 flex justify-center"><Brand /></div><ShieldX className="mx-auto size-12 text-red-500" /><h1 className="mt-5 text-2xl font-black text-[#102b4e]">Acesso não autorizado</h1><p className="mt-3 text-slate-600">Sua conta de autenticação existe, mas não está cadastrada como usuária ativa do painel. Solicite acesso a um administrador.</p></CardContent></Card></main>;
}
