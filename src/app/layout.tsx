import type { Metadata } from "next";
import { BackgroundGlow } from "@/components/theme/background-glow";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indicadores de Carteira | Adim Aluguéis",
  description: "Coleta e gestão dos indicadores mensais das carteiras Adim Aluguéis.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('painel-indicadores-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <BackgroundGlow />
          <div className="app-content-layer">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
