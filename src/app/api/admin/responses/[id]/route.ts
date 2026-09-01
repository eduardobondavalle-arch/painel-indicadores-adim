import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reopen"), justification: z.string().trim().min(5) }),
  z.object({ action: z.literal("delete"), justification: z.string().trim().min(5) }),
  z.object({ action: z.literal("edit"), indicatorKey: z.string().min(1), valueNumeric: z.number().nonnegative().nullable(), valueText: z.string().nullable(), justification: z.string().trim().min(5) }),
  z.object({ action: z.literal("note"), note: z.string(), justification: z.string().trim().min(5) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    let result;
    if (body.action === "reopen") result = await auth.supabase.rpc("reopen_response", { p_response_id: id, p_justification: body.justification });
    else if (body.action === "delete") result = await auth.supabase.rpc("soft_delete_response", { p_response_id: id, p_justification: body.justification });
    else if (body.action === "note") result = await auth.supabase.rpc("set_response_note", { p_response_id: id, p_note: body.note, p_justification: body.justification });
    else result = await auth.supabase.rpc("edit_response_indicator", { p_response_id: id, p_indicator_key: body.indicatorKey, p_value_numeric: body.valueNumeric, p_value_text: body.valueText, p_justification: body.justification });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Informe uma justificativa com pelo menos 5 caracteres e um valor válido." }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ação não realizada." }, { status: 500 });
  }
}
