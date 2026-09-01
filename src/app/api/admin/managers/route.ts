import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";

const schema = z.object({ id: z.uuid().optional(), name: z.string().trim().min(3), email: z.email().transform((value) => value.toLowerCase()), joinedOn: z.iso.date(), notes: z.string().max(3000), active: z.boolean() });

async function handle(request: NextRequest, update: boolean) {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = schema.parse(await request.json());
    if (update && !body.id) return NextResponse.json({ error: "Gestora não informada." }, { status: 400 });
    const payload = { name: body.name, email: body.email, joined_on: body.joinedOn, notes: body.notes || null, active: body.active };
    const result = update ? await auth.supabase.from("managers").update(payload).eq("id", body.id!).select("id").single() : await auth.supabase.from("managers").insert(payload).select("id").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    await auth.supabase.from("admin_logs").insert({ admin_user_id: auth.user.id, action: update ? "manager.updated" : "manager.created", entity_type: "manager", entity_id: result.data.id });
    return NextResponse.json({ ok: true, id: result.data.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revise nome, e-mail e data de entrada." }, { status: 422 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 500 });
  }
}
export async function POST(request: NextRequest) { return handle(request, false); }
export async function PATCH(request: NextRequest) { return handle(request, true); }
