import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";

const createSchema = z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100), closesAt: z.iso.datetime() });
const updateSchema = z.object({ id: z.uuid(), status: z.enum(["draft", "open", "closed"]), acceptLate: z.boolean().default(false) });

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try { const body = createSchema.parse(await request.json()); const { data, error } = await auth.supabase.from("submission_periods").insert({ reference_month: body.month, reference_year: body.year, status: "draft", closes_at: body.closesAt, created_by: auth.user.id }).select("id").single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await auth.supabase.from("admin_logs").insert({ admin_user_id: auth.user.id, action: "period.created", entity_type: "period", entity_id: data.id }); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Revise mês, ano e prazo." : "Não foi possível criar o período." }, { status: 422 }); }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try { const body = updateSchema.parse(await request.json()); const payload = { status: body.status, accept_late: body.status === "open" && body.acceptLate, ...(body.status === "open" ? { opens_at: new Date().toISOString() } : {}) }; const { error } = await auth.supabase.from("submission_periods").update(payload).eq("id", body.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await auth.supabase.from("admin_logs").insert({ admin_user_id: auth.user.id, action: `period.${body.status}`, entity_type: "period", entity_id: body.id, metadata: { accept_late: payload.accept_late } }); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Dados inválidos." : "Não foi possível atualizar o período." }, { status: 422 }); }
}
