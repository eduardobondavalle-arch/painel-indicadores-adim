import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-7xl font-black text-[#f28b30]">404</p>
        <h1 className="mt-4 text-3xl font-bold text-[#102b4e]">Página não encontrada</h1>
        <Button asChild className="mt-6"><Link href="/formulario">Ir para o formulário</Link></Button>
      </div>
    </main>
  );
}
