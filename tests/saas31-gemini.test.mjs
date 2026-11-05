import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const dir = await fs.mkdtemp(path.resolve(".qa-saas31-"));
for (const [name, source] of [
  ["gemini-errors", "saas2/gemini-errors"],
  ["gemini", "saas2/gemini"],
  ["runtime", "runtime-secret"],
]) {
  let code = ts.transpileModule(
    await fs.readFile("src/lib/" + source + ".ts", "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  ).outputText;
  code = code
    .replace('import "server-only";', "")
    .replace(
      'import { getCloudflareContext } from "@opennextjs/cloudflare";',
      'const getCloudflareContext=()=>{if(!globalThis.fixtureWorkerEnv)throw Error("No context");return {env:globalThis.fixtureWorkerEnv}};',
    )
    .replace(/(["'])\.\/gemini-errors\1/g, '"./gemini-errors.mjs"')
    .replace(/(["'])@\/lib\/saas2\/gemini\1/g, '"./gemini.mjs"');
  await fs.writeFile(path.join(dir, name + ".mjs"), code);
}
const { classifyGeminiError, safeGeminiDiagnostic, GeminiFailure } =
    await import(pathToFileURL(path.join(dir, "gemini-errors.mjs"))),
  { geminiRuntime } = await import(
    pathToFileURL(path.join(dir, "runtime.mjs"))
  ),
  { interpretWithGemini, cachedInterpretation } = await import(
    pathToFileURL(path.join(dir, "gemini.mjs"))
  );
after(() => fs.rm(dir, { recursive: true, force: true }));
test("Worker binding takes precedence; runtime metadata never exposes a credential", () => {
  const oldKey = process.env.GEMINI_API_KEY,
    oldModel = process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_API_KEY = "fixture-process-secret";
    delete process.env.GEMINI_MODEL;
    globalThis.fixtureWorkerEnv = {
      GEMINI_API_KEY: " fixture-worker-secret ",
      GEMINI_MODEL: "gemini-fixture-model",
    };
    const configured = geminiRuntime();
    assert.equal(configured.key, "fixture-worker-secret");
    assert.equal(configured.source, "cloudflare_binding");
    assert.equal(configured.model, "gemini-fixture-model");
    delete globalThis.fixtureWorkerEnv;
    assert.equal(geminiRuntime().source, "process_env");
    delete process.env.GEMINI_API_KEY;
    assert.equal(geminiRuntime().source, "missing");
    assert.equal(geminiRuntime().model, "gemini-flash-latest");
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = oldModel;
    delete globalThis.fixtureWorkerEnv;
  }
});
test("Provider failures are classified without returning raw provider text, keys or customer data", () => {
  for (const [error, category] of [
    [{ status: 400, message: "API_KEY_INVALID fixture-secret" }, "invalid_key"],
    [{ status: 403 }, "access_denied"],
    [{ status: 404 }, "model_unavailable"],
    [
      { status: 429, message: "GenerateRequestsPerDay quota exceeded" },
      "provider_quota",
    ],
    [{ status: 429, message: "RESOURCE_EXHAUSTED" }, "rate_limit"],
    [{ message: "timeout fixture-secret" }, "timeout"],
    [{ message: "fetch failed fixture-secret" }, "network"],
    [
      { status: 429, message: "quota exceeded GenerateRequestsPerMinute" },
      "rate_limit",
    ],
    [
      { status: 400, message: "response JSON schema invalid" },
      "structured_response",
    ],
    [{ status: 503 }, "provider_unavailable"],
    [new GeminiFailure("app_quota"), "app_quota"],
  ]) {
    const result = safeGeminiDiagnostic(error);
    assert.equal(result.category, category);
    assert(!JSON.stringify(result).includes("fixture-secret"));
  }
});
test("Real SDK request path, response schema, safe logging and model-specific deduplication", async () => {
  const original = globalThis.fetch,
    warn = console.warn,
    logs = [];
  let requests = 0,
    quota = 0;
  const valid = {
    resumo: "Diagnóstico técnico concluído.",
    pontos_positivos: [],
    pontos_de_atencao: [],
    sugestoes: [],
    prioridade: "normal",
  };
  try {
    console.warn = (...args) => logs.push(args.join(" "));
    globalThis.fetch = async (url) => {
      requests++;
      assert(String(url).includes("gemini-fixture"));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(valid) }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const result = await interpretWithGemini(
      "fixture-secret",
      { private: "customer-fixture" },
      "gemini-fixture",
    );
    assert.equal(result.summary, valid.resumo);
    await Promise.all([
      cachedInterpretation(
        "shop",
        "fixture-secret",
        { probe: 1 },
        async () => {
          quota++;
        },
        "gemini-fixture",
      ),
      cachedInterpretation(
        "shop",
        "fixture-secret",
        { probe: 1 },
        async () => {
          quota++;
        },
        "gemini-fixture",
      ),
    ]);
    assert.equal(quota, 1);
    await cachedInterpretation(
      "shop",
      "fixture-secret",
      { probe: 1 },
      async () => {
        quota++;
      },
      "gemini-fixture-2",
    );
    assert.equal(quota, 2);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 401,
            message: "invalid api key fixture-secret customer-fixture",
            status: "UNAUTHENTICATED",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    await assert.rejects(
      () => interpretWithGemini("fixture-secret", {}),
      (e) => classifyGeminiError(e).category === "invalid_key",
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: '{"unexpected":true}' }] } },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    await assert.rejects(
      () => interpretWithGemini("fixture-secret", {}),
      (e) => classifyGeminiError(e).category === "structured_response",
    );
    assert(logs.length >= 2);
    assert(!logs.join().includes("fixture-secret"));
    assert(!logs.join().includes("customer-fixture"));
    assert(requests >= 3);
  } finally {
    globalThis.fetch = original;
    console.warn = warn;
  }
});

test("Only a valid PostgreSQL/PostgREST code is exposed in quota diagnostics",()=>{assert.equal(safeGeminiDiagnostic(new GeminiFailure("quota_check",null,"PGRST202")).rpcCode,"PGRST202");assert.equal(safeGeminiDiagnostic(new GeminiFailure("quota_check",null,"fixture-secret")).rpcCode,null);});
