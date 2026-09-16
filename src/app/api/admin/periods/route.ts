import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { loadPerformance } from "@/lib/performance-data";

const createSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  closesAt: z.iso.datetime(),
});

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["draft", "open", "closed"]).optional(),
  acceptLate: z.boolean().optional(),
  closesAt: z.iso.datetime().nullable().optional(),
}).refine((body) => body.status !== undefined || body.closesAt !== undefined, {
  message: "Informe o status ou o novo prazo.",
});

type PeriodStatus = "draft" | "open" | "closed";
type PeriodRow = {
  id: string;
  status: PeriodStatus;
  opens_at: string | null;
  closes_at: string | null;
  accept_late: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = createSchema.parse(await request.json());
    const { data, error } = await auth.supabase
      .from("submission_periods")
      .insert({
        reference_month: body.month,
        reference_year: body.year,
        status: "draft",
        closes_at: body.closesAt,
        created_by: auth.user.id,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auth.supabase.from("admin_logs").insert({
      admin_user_id: auth.user.id,
      action: "period.created",
      entity_type: "period",
      entity_id: data.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof z.ZodError ? "Revise mês, ano e prazo." : "Não foi possível criar o período.",
    }, { status: 422 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = updateSchema.parse(await request.json());
    const currentResult = await auth.supabase
      .from("submission_periods")
      .select("id,status,opens_at,closes_at,accept_late")
      .eq("id", body.id)
      .single();

    if (currentResult.error || !currentResult.data) {
      return NextResponse.json({ error: "Período não encontrado." }, { status: 404 });
    }

    const current = currentResult.data as PeriodRow;
    const nextStatus = body.status ?? current.status;
    if (nextStatus === "closed" && current.status !== "closed") {
      if (current.status !== "open") return NextResponse.json({ error: "Abra o período antes de fechá-lo." }, { status: 422 });
      const active = await auth.supabase.from("responses").select("id,period_id").eq("period_id", body.id).in("status", ["submitted", "reopened"]);
      if (active.error) throw active.error;
      const performance = await loadPerformance(auth.supabase, active.data ?? []);
      const versionId = performance.frozenVersions.get(body.id) ?? performance.liveVersionId;
      if (!versionId) return NextResponse.json({ error: "Régua oficial ainda não versionada." }, { status: 422 });
      const pending = (active.data ?? []).find(row => performance.results.get(row.id)?.score === null);
      if (pending) return NextResponse.json({ error: "Existem respostas sem dados suficientes para calcular o score; preencha os dados complementares antes do fechamento." }, { status: 422 });
      const { error } = await auth.supabase.rpc("close_period_with_scores", { p_period_id: body.id, p_version_id: versionId,
        p_results: (active.data ?? []).map(row => ({ response_id: row.id, result: performance.results.get(row.id) })) });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, period: { ...current, status: "closed", accept_late: false } });
    }
    const nextClosesAt = body.closesAt === undefined ? current.closes_at : body.closesAt;
    const now = new Date();
    const opensAt = current.opens_at ?? (nextStatus === "open" ? now.toISOString() : null);

    if (opensAt && nextClosesAt && new Date(nextClosesAt) <= new Date(opensAt)) {
      return NextResponse.json({
        error: "A data limite deve ser posterior à abertura do período.",
      }, { status: 422 });
    }

    const payload: {
      status?: PeriodStatus;
      closes_at?: string | null;
      opens_at?: string;
      accept_late?: boolean;
    } = {};

    if (body.status !== undefined) payload.status = nextStatus;
    if (body.closesAt !== undefined) payload.closes_at = body.closesAt;

    if (nextStatus === "open") {
      if (!current.opens_at) payload.opens_at = now.toISOString();
      payload.accept_late = body.acceptLate
        ?? Boolean(nextClosesAt && new Date(nextClosesAt) < now);
    } else if (body.status !== undefined) {
      payload.accept_late = false;
    }

    const updateResult = await auth.supabase
      .from("submission_periods")
      .update(payload)
      .eq("id", body.id)
      .select("id,status,opens_at,closes_at,accept_late")
      .single();

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 400 });
    }

    const action = body.closesAt !== undefined ? "period.adjusted" : `period.${nextStatus}`;
    await auth.supabase.from("admin_logs").insert({
      admin_user_id: auth.user.id,
      action,
      entity_type: "period",
      entity_id: body.id,
      metadata: {
        previous_status: current.status,
        status: nextStatus,
        previous_closes_at: current.closes_at,
        closes_at: nextClosesAt,
        accept_late: updateResult.data.accept_late,
      },
    });

    return NextResponse.json({ ok: true, period: updateResult.data });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof z.ZodError ? "Dados inválidos." : "Não foi possível atualizar o período.",
    }, { status: 422 });
  }
}
