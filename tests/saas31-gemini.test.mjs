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

test("Only a valid PostgreSQL/PostgREST code is exposed in quota diagnostics", () => {
  assert.equal(
    safeGeminiDiagnostic(new GeminiFailure("quota_check", null, "PGRST202"))
      .rpcCode,
    "PGRST202",
  );
  assert.equal(
    safeGeminiDiagnostic(
      new GeminiFailure("quota_check", null, "fixture-secret"),
    ).rpcCode,
    null,
  );
});

test("A isolates an unstructured API call; a received 504 is not fabricated as an application deadline", async () => {
  const original = globalThis.fetch;
  let body;
  try {
    globalThis.fetch = async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "OK" }] } }],
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const result = await interpretWithGemini(
      "fixture-secret",
      { private: "must-not-be-sent" },
      "gemini-fixture",
      "A",
    );
    assert.equal(result.trace.profile, "A");
    assert.equal(body.generationConfig.responseJsonSchema, undefined);
    assert.equal(body.systemInstruction, undefined);
    assert(!JSON.stringify(body).includes("must-not-be-sent"));
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 504,
            message: "upstream deadline",
            status: "DEADLINE_EXCEEDED",
          },
        }),
        { status: 504, headers: { "content-type": "application/json" } },
      );
    await assert.rejects(
      () => interpretWithGemini("fixture-secret", {}, "gemini-fixture", "B"),
      (e) => {
        assert.equal(e.status, 504);
        assert.equal(e.trace.origin, "upstream_http");
        assert.equal(e.trace.stage, "provider_request");
        assert(e.trace.durationMs < 30000);
        assert(
          !JSON.stringify(safeGeminiDiagnostic(e)).includes("fixture-secret"),
        );
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("Application deadline aborts actual SDK fetch once and exposes no invented HTTP status", async (t) => {
  const original = globalThis.fetch;
  let ready,
    requests = 0;
  const waiting = new Promise((r) => {
    ready = r;
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    globalThis.fetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        requests++;
        init.signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
        ready();
      });
    const response = interpretWithGemini(
      "fixture-secret",
      {},
      "gemini-fixture",
      "B",
    );
    const rejection = assert.rejects(
      () => response,
      (e) => {
        assert.equal(e.category, "timeout");
        assert.equal(e.status, null);
        assert.equal(e.trace.origin, "application_deadline");
        assert.equal(e.trace.deadlineMs, 30000);
        return true;
      },
    );
    await waiting;
    t.mock.timers.tick(30001);
    await rejection;
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = original;
    t.mock.timers.reset();
  }
});

test("Authenticated A–D diagnostic separates data stage, preserves quota gate and returns no secret", async () => {
  let code = ts.transpileModule(
    await fs.readFile("src/app/actions/gemini-diagnostic-actions.ts", "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  ).outputText;
  code = code
    .replace(
      /import \{ GeminiFailure, safeGeminiDiagnostic \} from [^;]+;/,
      'import { GeminiFailure, safeGeminiDiagnostic } from "./gemini-errors.mjs";',
    )
    .replace(
      /import \{ resolveCurrentShop \} from [^;]+;/,
      "const resolveCurrentShop=(...args)=>globalThis.diagnosticFixture.auth(...args);",
    )
    .replace(
      /import \{ geminiRuntime \} from [^;]+;/,
      'const geminiRuntime=()=>({key:"fixture-private-key",source:"cloudflare_binding",contextAvailable:true,model:"gemini-fixture"});',
    )
    .replace(
      /import \{ cachedInterpretation, geminiDeadlineMs,?\s*\} from [^;]+;/,
      "const geminiDeadlineMs=30000;const cachedInterpretation=(...args)=>globalThis.diagnosticFixture.cached(...args);",
    )
    .replace(
      /import \{ loadIntelligence \} from [^;]+;/,
      "const loadIntelligence=(...args)=>globalThis.diagnosticFixture.data(...args);",
    )
    .replace(
      /import \{ localDate, shiftDate \} from [^;]+;/,
      'const localDate=()=>"2026-11-05";const shiftDate=()=>"2026-10-30";',
    );
  await fs.writeFile(path.join(dir, "diagnostic.mjs"), code);
  const { geminiDiagnosticAction } = await import(
    pathToFileURL(path.join(dir, "diagnostic.mjs"))
  );
  let reads = 0,
    providerCalls = 0,
    quota = 0,
    allowed = true,
    dataFails = false,
    authorized = true;
  const fixture = {
    auth: async () => {
      if (!authorized) throw Error("Acesso negado");
      return {
        shop: "shop-fixture",
        db: {
          rpc: async () => {
            quota++;
            return { data: allowed, error: null };
          },
        },
      };
    },
    data: async () => {
      reads++;
      if (dataFails) throw Error("sensitive provider text");
      return {
        current: {
          income: 50,
          valid: 2,
          expected: 100,
          expenses: 10,
          refunds: 0,
          registeredBalance: 40,
          completed: 1,
          occupancy: 0.1,
          daily: [],
          services: [],
          notes: [],
          phone: "must-not-leak",
        },
        previous: { income: 25 },
      };
    },
    cached: async (shop, key, aggregate, consume, model, profile) => {
      assert.equal(shop, "shop-fixture");
      assert.equal(key, "fixture-private-key");
      assert.equal(model, "gemini-fixture");
      assert(["A", "B", "C", "D"].includes(profile));
      assert(!JSON.stringify(aggregate).includes("must-not-leak"));
      await consume();
      providerCalls++;
      return { trace: { stage: "complete", durationMs: 1 } };
    },
  };
  globalThis.diagnosticFixture = fixture;
  try {
    const metadata = await geminiDiagnosticAction();
    assert(metadata.ok);
    assert.equal(quota, 0);
    for (const profile of ["A", "B", "C", "D"]) {
      const r = await geminiDiagnosticAction(true, profile);
      assert(r.ok);
      assert.equal(r.timing.profile, profile);
      assert(!JSON.stringify(r).includes("fixture-private-key"));
    }
    assert.equal(reads, 2);
    assert.equal(providerCalls, 4);
    assert.equal(quota, 4);
    allowed = false;
    const rejected = await geminiDiagnosticAction(true, "A");
    assert.equal(rejected.category, "app_quota");
    assert.equal(providerCalls, 4);
    dataFails = true;
    const dataFailure = await geminiDiagnosticAction(true, "C");
    assert.equal(dataFailure.category, "data_query");
    assert.equal(dataFailure.timing.stage, "supabase_aggregate");
    assert.equal(quota, 5);
    assert(!JSON.stringify(dataFailure).includes("sensitive provider text"));
    authorized = false;
    const denied = await geminiDiagnosticAction(true, "A");
    assert.equal(denied.category, "authorization");
    assert.equal(quota, 5);
  } finally {
    delete globalThis.diagnosticFixture;
  }
});
