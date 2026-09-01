import { createClient } from "@supabase/supabase-js";
import { INDICATORS } from "../src/lib/indicators.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const now = new Date();
const month = now.getMonth() + 1;
const year = now.getFullYear();
const demoManagers = [
  { name: "Ana Demonstração", email: "ana.demo@adimimoveis.com.br", active: true, joined_on: `${year}-01-10`, notes: "DADO FICTÍCIO DE DEMONSTRAÇÃO", is_demo: true },
  { name: "Beatriz Demonstração", email: "beatriz.demo@adimimoveis.com.br", active: true, joined_on: `${year}-02-05`, notes: "DADO FICTÍCIO DE DEMONSTRAÇÃO — pendente no período atual", is_demo: true },
];
const managerResult = await supabase.from("managers").upsert(demoManagers, { onConflict: "email" }).select("id,name,email");
if (managerResult.error) throw managerResult.error;

const deadline = new Date(year, month, 7, 23, 59, 59).toISOString();
const periodResult = await supabase.from("submission_periods").upsert({ reference_month: month, reference_year: year, status: "open", opens_at: new Date().toISOString(), closes_at: deadline }, { onConflict: "reference_month,reference_year" }).select("id").single();
if (periodResult.error) throw periodResult.error;

const demoByNumber = {
  1: 120, 2: 10, 3: 8, 4: 2, 5: "Mudança de cidade e venda do imóvel.", 6: 80, 7: 6, 8: 4, 9: 7, 10: 4500.5, 11: 6.3,
  12: 3, 13: 2, 14: 1, 15: 0, 16: 3, 17: 0, 18: 2, 19: 1, 20: "Proprietário optou pela venda direta.",
  21: 14, 22: 12, 23: 2, 24: 8, 25: 6, 26: 1.5, 27: 36, 28: 10, 29: 2, 30: 1, 31: 7.14, 32: 86,
  33: 1.2, 34: 90, 35: 15, 36: 85, 37: 20, 38: 0, 39: 0, 40: 0, 41: "",
  42: 2, 43: 6200, 44: 310, 45: 3, 46: 2, 47: 1, 48: 2,
  49: 120, 50: 100, 51: 20, 52: 90, 53: 30, 54: "Acompanhar dois contratos comerciais em negociação.", 55: "Anteciparia o contato com proprietários em mais uma semana.",
};
const values = INDICATORS.map((indicator) => ({ key: indicator.key, number: indicator.number, block: indicator.block, label: indicator.label, type: indicator.type, value: demoByNumber[indicator.number] }));
const submitted = await supabase.rpc("submit_monthly_response", { p_manager_name: demoManagers[0].name, p_manager_email: demoManagers[0].email, p_reference_month: month, p_reference_year: year, p_confirmed_review: true, p_values: values, p_alerts: [] });
if (submitted.error && !submitted.error.message.includes("Já existe")) throw submitted.error;
if (!submitted.error) {
  await supabase.from("responses").update({ is_demo: true }).eq("id", submitted.data.id);
  console.log(`Resposta fictícia criada. Protocolo: ${submitted.data.protocol}`);
} else {
  console.log("A resposta fictícia do período atual já existe; nada foi duplicado.");
}
console.log("Dados de demonstração claramente marcados com is_demo=true.");
