import http from "node:https";

const requiredVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const optionalVars = [
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_WEBHOOK_SECRET",
  "RESEND_API_KEY",
];

console.log("\n==========================================");
console.log(" VERIFICAÇÃO DE AMBIENTE: DONO (ADMIN)");
console.log("==========================================\n");

let hasError = false;

console.log("--- Variáveis Obrigatórias ---");
for (const key of requiredVars) {
  const val = process.env[key];
  if (!val || val.includes("dummy") || val.includes("SEU_") || val.trim() === "") {
    console.error(`❌ [ERRO] ${key} não configurada ou com valor inválido.`);
    hasError = true;
  } else {
    console.log(`✅ [OK]   ${key}`);
  }
}

console.log("\n--- Integrações Opcionais ---");
for (const key of optionalVars) {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    console.log(`⚠️  [AVISO] ${key} não definida (Integração operará em modo desativado).`);
  } else {
    console.log(`✅ [OK]   ${key}`);
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (supabaseUrl && !supabaseUrl.includes("dummy")) {
  try {
    const url = new URL(supabaseUrl);
    console.log(`\nTestando conectividade com ${url.origin}...`);
    const req = http.get(`${url.origin}/auth/v1/health`, (res) => {
      console.log(`✅ [OK]   Conexão com Supabase respondendo (Status: ${res.statusCode})`);
      process.exit(hasError ? 1 : 0);
    });
    req.on("error", (err) => {
      console.error(`❌ [ERRO] Falha ao conectar ao Supabase: ${err.message}`);
      process.exit(1);
    });
  } catch (e) {
    console.error(`❌ [ERRO] URL inválida: ${supabaseUrl}`);
    process.exit(1);
  }
} else {
  console.log("\n⚠️  Supabase URL não definida. Configure o .env.local para testar a conexão.");
  process.exit(hasError ? 1 : 0);
}
