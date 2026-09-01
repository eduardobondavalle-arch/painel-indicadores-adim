"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardList,
  FileClock,
  Gauge,
  History,
  ListFilter,
  Settings2,
  SlidersHorizontal,
  UserCircle,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/gestao/visao-geral", label: "Visão geral", icon: Gauge },
  { href: "/gestao/indicadores", label: "Indicadores", icon: ListFilter },
  { href: "/gestao/envios", label: "Envios", icon: ClipboardList },
  { href: "/gestao/comparativo", label: "Comparativo", icon: BarChart3 },
  { href: "/gestao/evolucao", label: "Evolução", icon: Activity },
  { href: "/gestao/ranking", label: "Ranking", icon: SlidersHorizontal },
  { href: "/gestao/gestoras", label: "Gestoras", icon: Users },
  { href: "/gestao/periodos", label: "Períodos", icon: FileClock },
  { href: "/gestao/parametros", label: "Parâmetros", icon: Settings2 },
  { href: "/gestao/auditoria", label: "Auditoria", icon: History },
];

type Profile = { display_name: string; email: string; role: string };

function AccountLink({ profile, compact = false }: { profile: Profile; compact?: boolean }) {
  return (
    <Link
      href="/gestao/conta"
      className="focus-ring press flex h-10 max-w-56 items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      aria-label={`Acessar conta de ${profile.display_name}`}
    >
      <UserCircle className="size-[18px] shrink-0" strokeWidth={1.7} />
      {!compact && <span className="truncate">{profile.display_name || profile.email}</span>}
    </Link>
  );
}

export function DashboardShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollVelocityRef = useRef(0);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });

  const updateScrollEdges = useCallback(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const maximum = navigation.scrollWidth - navigation.clientWidth;
    const left = navigation.scrollLeft > 2;
    const right = maximum > 2 && navigation.scrollLeft < maximum - 2;
    setScrollEdges((current) => current.left === left && current.right === right ? current : { left, right });
  }, []);

  const stopEdgeScroll = useCallback(() => {
    scrollVelocityRef.current = 0;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const runEdgeScroll = useCallback(() => {
    const navigation = navigationRef.current;
    const velocity = scrollVelocityRef.current;
    if (!navigation || velocity === 0) {
      animationFrameRef.current = null;
      return;
    }

    navigation.scrollLeft += velocity;
    updateScrollEdges();

    const maximum = navigation.scrollWidth - navigation.clientWidth;
    if ((velocity < 0 && navigation.scrollLeft <= 0) || (velocity > 0 && navigation.scrollLeft >= maximum - 1)) {
      scrollVelocityRef.current = 0;
      animationFrameRef.current = null;
      return;
    }

    animationFrameRef.current = requestAnimationFrame(runEdgeScroll);
  }, [updateScrollEdges]);

  const setEdgeScroll = useCallback((velocity: number) => {
    scrollVelocityRef.current = velocity;
    if (velocity === 0) {
      stopEdgeScroll();
      return;
    }
    if (animationFrameRef.current === null) animationFrameRef.current = requestAnimationFrame(runEdgeScroll);
  }, [runEdgeScroll, stopEdgeScroll]);

  const handleNavigationPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const edgeSize = Math.min(64, bounds.width * 0.2);
    const distanceFromLeft = event.clientX - bounds.left;
    const distanceFromRight = bounds.right - event.clientX;

    if (distanceFromLeft < edgeSize && scrollEdges.left) {
      const strength = 1 - distanceFromLeft / edgeSize;
      setEdgeScroll(-(2 + strength * 8));
    } else if (distanceFromRight < edgeSize && scrollEdges.right) {
      const strength = 1 - distanceFromRight / edgeSize;
      setEdgeScroll(2 + strength * 8);
    } else {
      setEdgeScroll(0);
    }
  }, [scrollEdges, setEdgeScroll]);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(navigation);
    navigation.addEventListener("scroll", updateScrollEdges, { passive: true });
    updateScrollEdges();
    return () => {
      observer.disconnect();
      navigation.removeEventListener("scroll", updateScrollEdges);
      stopEdgeScroll();
    };
  }, [stopEdgeScroll, updateScrollEdges]);

  useEffect(() => {
    const activeLink = navigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activeLink?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    const timer = window.setTimeout(updateScrollEdges, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, updateScrollEdges]);

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="mx-auto flex min-h-16 max-w-[1800px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Brand />
            <span className="hidden h-8 w-px bg-border sm:block" />
            <p className="label-caps hidden whitespace-nowrap lg:block">Gestão de indicadores</p>
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              ref={navigationRef}
              className="scroll-x-soft"
              onPointerMove={handleNavigationPointerMove}
              onPointerLeave={stopEdgeScroll}
              onPointerCancel={stopEdgeScroll}
            >
              <nav className="flex w-max items-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-1" aria-label="Navegação do painel">
                {links.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring press flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-2.5 text-sm text-muted-foreground hover:bg-background/70 hover:text-foreground md:px-3",
                        active && "bg-[var(--glass-strong)] text-foreground shadow-sm backdrop-blur-xl",
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.8} />
                      <span className="hidden md:inline">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            {scrollEdges.left && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 left-0 z-10 w-10 rounded-l-full"
                style={{ background: "linear-gradient(90deg, var(--glass-strong), transparent)" }}
              />
            )}
            {scrollEdges.right && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 right-0 z-10 w-10 rounded-r-full"
                style={{ background: "linear-gradient(270deg, var(--glass-strong), transparent)" }}
              />
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 px-1 text-xs text-muted-foreground 2xl:flex">
              <span className="size-2 rounded-full bg-emerald-500" />
              Protegido
            </span>
            <ThemeToggle />
            <AccountLink profile={profile} compact />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main key={pathname} className="page-transition mx-auto max-w-[1800px] px-4 py-7 sm:px-6 sm:py-9">
        {children}
      </main>
    </div>
  );
}
