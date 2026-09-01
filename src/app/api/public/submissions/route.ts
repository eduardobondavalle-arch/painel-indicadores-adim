import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConsistencyAlerts } from "@/lib/consistency";
import { createPublicClient } from "@/lib/supabase/server";
import { parseSubmission, serializeIndicatorValues } from "@/lib/submission";

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 150_000) return NextResponse.json({ error: "Envio maior que o limite permitido." }, { status: 413 });
  try {
    const input = parseSubmission(await request.json());
    const alerts = getConsistencyAlerts(input.values);
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("submit_monthly_response", {
      p_manager_name: input.managerName,
      p_manager_email: input.managerEmail,
      p_reference_month: input.referenceMonth,
      p_reference_year: input.referenceYear,
      p_confirmed_review: input.confirmedReview,
      p_values: serializeIndicatorValues(input.values),
      p_alerts: alerts,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Revise os campos destacados.", issues: z.flattenError(error).fieldErrors }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Não foi possível registrar o envio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
