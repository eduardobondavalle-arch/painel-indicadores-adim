import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_INITIAL_EMAIL || "gestao@adimimoveis.com.br").trim().toLowerCase();
const password = process.env.ADMIN_INITIAL_PASSWORD;
const displayName = process.env.ADMIN_INITIAL_NAME || "Direção Adim";

if (!url || !serviceRoleKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
if (!password || password.length < 10) throw new Error("ADMIN_INITIAL_PASSWORD deve ter pelo menos 10 caracteres.");

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;
let user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email);

if (user) {
  const updated = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (updated.error) throw updated.error;
  user = updated.data.user;
  console.log(`Senha redefinida para ${email}.`);
} else {
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (created.error) throw created.error;
  user = created.data.user;
  console.log(`Usuário de autenticação criado para ${email}.`);
}

const profile = await supabase.from("admin_users").upsert({ id: user.id, email, display_name: displayName, role: "admin", active: true }, { onConflict: "id" });
if (profile.error) throw profile.error;
console.log("Perfil administrativo ativo. Remova ADMIN_INITIAL_PASSWORD do ambiente após o primeiro acesso.");
