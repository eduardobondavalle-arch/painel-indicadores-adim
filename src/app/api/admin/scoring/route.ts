import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { scoringConfigurationIssues } from "@/lib/scoring";

const schema = z.object({
  justification: z.string().trim().min(5),
  pillars: z.array(z.object({ id: z.uuid(), pillar_number: z.number().int().min(1).max(5), name: z.string().min(2), weight: z.number().min(0).max(100), minimum_lock: z.number().min(0).max(100), complaint_absence_weight: z.number().min(0).max(100) })).length(5),
  parameters: z.array(z.object({ indicator_key: z.string(), pillar_id: z.uuid(), weight: z.number().min(0).max(100), minimum_goal: z.number(), maximum_goal: z.number(), direction: z.enum(["higher_is_better", "lower_is_better"]), formal_complaint_veto: z.boolean() })).length(15),
  bonuses: z.array(z.object({ id: z.uuid(), label: z.string(), minimum_score: z.number().min(0).max(100), amount: z.union([z.literal(300), z.literal(500), z.literal(800)]) })).length(3),
});

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { justification, ...configuration } = schema.parse(await request.json());
    const issues = scoringConfigurationIssues(configuration.pillars, configuration.parameters, configuration.bonuses);
    if (issues.length) return NextResponse.json({ error: issues.join(" ") }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("save_official_scoring_rules", { p_configuration: configuration, p_reason: justification });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, version: data });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revise os pesos, metas, travas e a justificativa." }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao salvar os parâmetros." }, { status: 500 });
  }
}
