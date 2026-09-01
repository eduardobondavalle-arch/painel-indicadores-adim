import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";

const nullableNumber = z.number().min(0).max(100).nullable();
const schema = z.object({
  pillars: z.array(z.object({ id: z.uuid(), pillar_number: z.number(), name: z.string().trim().min(2), weight: nullableNumber, minimum_lock: nullableNumber })).length(5),
  parameters: z.array(z.object({ id: z.uuid().optional(), indicator_key: z.string().min(1), pillar_id: z.uuid(), weight: nullableNumber, minimum_goal: z.number().min(0).nullable(), maximum_goal: z.number().min(0).nullable(), direction: z.enum(["higher_is_better", "lower_is_better"]).nullable(), formal_complaint_veto: z.boolean() })),
  bonuses: z.array(z.object({ id: z.uuid(), label: z.string(), minimum_score: nullableNumber, amount: z.union([z.literal(300), z.literal(500), z.literal(800)]) })).length(3),
});

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = schema.parse(await request.json());
    for (const pillar of body.pillars) { const { error } = await auth.supabase.from("scoring_pillars").update({ name: pillar.name, weight: pillar.weight, minimum_lock: pillar.minimum_lock, updated_by: auth.user.id }).eq("id", pillar.id); if (error) throw error; }
    const activeKeys = body.parameters.map((parameter) => parameter.indicator_key);
    const existing = await auth.supabase.from("scoring_parameters").select("indicator_key");
    const removed = (existing.data ?? []).map((item) => item.indicator_key).filter((key) => !activeKeys.includes(key));
    if (removed.length) { const { error } = await auth.supabase.from("scoring_parameters").delete().in("indicator_key", removed); if (error) throw error; }
    if (body.parameters.length) { const { error } = await auth.supabase.from("scoring_parameters").upsert(body.parameters.map((parameter) => ({ indicator_key: parameter.indicator_key, pillar_id: parameter.pillar_id, weight: parameter.weight, minimum_goal: parameter.minimum_goal, maximum_goal: parameter.maximum_goal, direction: parameter.direction, formal_complaint_veto: parameter.formal_complaint_veto, updated_by: auth.user.id })), { onConflict: "indicator_key" }); if (error) throw error; }
    for (const bonus of body.bonuses) { const { error } = await auth.supabase.from("bonus_ranges").update({ minimum_score: bonus.minimum_score, updated_by: auth.user.id }).eq("id", bonus.id); if (error) throw error; }
    await auth.supabase.from("admin_logs").insert({ admin_user_id: auth.user.id, action: "scoring.updated", entity_type: "scoring", metadata: { configured_indicators: body.parameters.length } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Há parâmetros inválidos. Revise limites, pesos e metas." }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar os parâmetros." }, { status: 500 });
  }
}
