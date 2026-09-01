import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("get_open_periods");
    if (error) throw error;
    return NextResponse.json({ periods: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar os períodos.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
