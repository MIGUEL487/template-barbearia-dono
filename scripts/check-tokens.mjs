import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const tokenPath = path.resolve("src/styles/design-tokens.css");
const shaPath = path.resolve("design-tokens.sha256");

if (!fs.existsSync(tokenPath)) {
  console.error("❌ [ERRO] design-tokens.css não encontrado.");
  process.exit(1);
}

const content = fs.readFileSync(tokenPath, "utf-8").replace(/\r\n/g, "\n");
const hash = crypto.createHash("sha256").update(content).digest("hex");

if (!fs.existsSync(shaPath)) {
  fs.writeFileSync(shaPath, hash + "\n");
  console.log(`✅ design-tokens.sha256 criado com hash: ${hash}`);
  process.exit(0);
}

const expectedHash = fs.readFileSync(shaPath, "utf-8").trim();

if (hash !== expectedHash) {
  console.error(`❌ [ERRO] design-tokens.css divergiu!`);
  console.error(`Esperado: ${expectedHash}`);
  console.error(`Atual:    ${hash}`);
  console.error("Ao alterar tokens em um repositório, sincronize o arquivo e atualize o hash em ambos.");
  process.exit(1);
}

console.log(`✅ [OK] design-tokens.css sincronizado (${hash.substring(0, 8)}...)`);
process.exit(0);
