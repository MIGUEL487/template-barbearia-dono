import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const dir = await fs.mkdtemp(path.resolve(".qa-openrouter-"));
for (const [name, source] of [
  ["ai-errors", "saas2/ai-errors"],
  ["openrouter", "saas2/openrouter"],
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
    .replace(/(["'])\.\/ai-errors\1/g, '"./ai-errors.mjs"')
    .replace(/(["'])@\/lib\/saas2\/openrouter\1/g, '"./openrouter.mjs"');
  await fs.writeFile(path.join(dir, name + ".mjs"), code);
}
const { interpretWithOpenRouter, cachedInterpretation, verifyOpenRouterModel } =
  await import(pathToFileURL(path.join(dir, "openrouter.mjs")));
const { aiRuntime } = await import(
  pathToFileURL(path.join(dir, "runtime.mjs"))
);
const { AiFailure, safeAiDiagnostic, assertAiQuotaResult } = await import(
  pathToFileURL(path.join(dir, "ai-errors.mjs"))
);
after(() => fs.rm(dir, { recursive: true, force: true }));
const valid = {
  resumo: "Indicadores interpretados.",
  pontos_positivos: [],
  pontos_de_atencao: ["Verificar pré-reservas."],
  sugestoes: [],
  prioridade: "normal",
};
const json = (x, status = 200) =>
  new Response(JSON.stringify(x), {
    status,
    headers: { "content-type": "application/json" },
  });
const answer = (content = JSON.stringify(valid), finish = "stop") =>
  json({
    choices: [
      { message: { role: "assistant", content }, finish_reason: finish },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      cost: 0.00003,
    },
  });
const catalog = (...ids) =>
  json({
    data: ids.map((id) => ({
      id,
      supported_parameters: ["response_format", "structured_outputs"],
    })),
  });
test("Runtime uses only OpenRouter secrets, validates model and bounds configurable deadline", () => {
  const previous = {};
  for (const k of [
    "OPENROUTER_API_KEY",
    "OPENROUTER_MODEL",
    "OPENROUTER_TIMEOUT_MS",
    "GEMINI_API_KEY",
  ])
    previous[k] = process.env[k];
  try {
    process.env.OPENROUTER_API_KEY = "fixture-process-key";
    process.env.OPENROUTER_MODEL = "openai/gpt-4o-mini";
    process.env.OPENROUTER_TIMEOUT_MS = "10000";
    process.env.GEMINI_API_KEY = "must-not-be-used";
    globalThis.fixtureWorkerEnv = {
      OPENROUTER_API_KEY: " fixture-worker-key ",
      OPENROUTER_MODEL: "fixture/model",
      OPENROUTER_TIMEOUT_MS: "12000",
    };
    assert.equal(aiRuntime().key, "fixture-worker-key");
    assert.equal(aiRuntime().source, "cloudflare_binding");
    assert.equal(aiRuntime().model, "fixture/model");
    assert.equal(aiRuntime().timeoutMs, 12000);
    globalThis.fixtureWorkerEnv.OPENROUTER_MODEL = "not-a-model";
    assert.equal(aiRuntime().model, "");
    globalThis.fixtureWorkerEnv.OPENROUTER_TIMEOUT_MS = "999999";
    assert.equal(aiRuntime().timeoutMs, 30000);
    delete globalThis.fixtureWorkerEnv;
    assert.equal(aiRuntime().source, "process_env");
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    assert.equal(aiRuntime().source, "missing");
    assert.equal(aiRuntime().model, "openai/gpt-4o-mini");
    assert.equal(aiRuntime().key, "");
  } finally {
    delete globalThis.fixtureWorkerEnv;
    for (const [k, v] of Object.entries(previous))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  }
});
test("HTTP errors remain distinct and never expose raw provider messages", () => {
  for (const [status, category] of [
    [401, "invalid_key"],
    [402, "insufficient_credits"],
    [403, "access_denied"],
    [404, "model_unavailable"],
    [408, "request_timeout"],
    [429, "rate_limit"],
    [502, "bad_gateway"],
    [503, "provider_unavailable"],
    [504, "gateway_timeout"],
  ]) {
    const d = safeAiDiagnostic({
      status,
      message: "fixture-secret private-customer",
    });
    assert.equal(d.category, category);
    assert.equal(d.status, status);
    assert(!JSON.stringify(d).includes("fixture-secret"));
    assert(!JSON.stringify(d).includes("private-customer"));
  }
  assert.equal(
    safeAiDiagnostic(new AiFailure("quota_check", null, "PGRST202")).rpcCode,
    "PGRST202",
  );
  assert.equal(
    safeAiDiagnostic(new AiFailure("quota_check", null, "fixture-secret"))
      .rpcCode,
    null,
  );
});
test("Native HTTP request uses structured schema, bounded tokens, no tools and only approved aggregates", async () => {
  const original = globalThis.fetch,
    info = console.info,
    warn = console.warn,
    logs = [];
  let body,
    count = 0;
  try {
    console.info = (...x) => logs.push(x.join(" "));
    console.warn = (...x) => logs.push(x.join(" "));
    globalThis.fetch = async (url, init) => {
      count++;
      assert.equal(
        String(url),
        "https://openrouter.ai/api/v1/chat/completions",
      );
      assert.equal(init.headers.Authorization, "Bearer fixture-secret");
      assert.equal(init.redirect, "manual");
      assert.equal(init.cache, "no-store");
      body = JSON.parse(init.body);
      return answer();
    };
    const r = await interpretWithOpenRouter(
      "fixture-secret",
      {
        question: "Como está a agenda?",
        receivedCents: 5000,
        phone: "private-customer",
      },
      "fixture/model",
    );
    assert.equal(r.summary, valid.resumo);
    assert.equal(body.max_tokens, 1400);
    assert.equal(body.stream, false);
    assert.equal(body.tools, undefined);
    assert.equal(body.provider.require_parameters, true);
    assert.equal(body.provider.allow_fallbacks, false);
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert(!JSON.stringify(body).includes("private-customer"));
    assert.equal(r.usage.costUsd, 0.00003);
    assert.equal(r.usage.totalTokens, 30);
    await interpretWithOpenRouter(
      "fixture-secret",
      { question: "private-customer" },
      "fixture/model",
      "A",
    );
    assert.equal(body.response_format, undefined);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].content, "Responda somente OK.");
    assert.equal(count, 2);
    assert(!logs.join().includes("fixture-secret"));
    assert(!logs.join().includes("private-customer"));
  } finally {
    globalThis.fetch = original;
    console.info = info;
    console.warn = warn;
  }
});
test("Rejects missing key, oversized context, invalid JSON and incomplete responses without a repair call", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return answer();
    };
    await assert.rejects(
      () => interpretWithOpenRouter("", {}),
      (e) => e.category === "missing_runtime_key",
    );
    await assert.rejects(
      () => interpretWithOpenRouter("fixture", { question: "x".repeat(1001) }),
      (e) => e.category === "context_limit",
    );
    assert.equal(calls, 0);
    for (const [response, category] of [
      [answer("{}"), "structured_response"],
      [answer("broken"), "structured_response"],
      [answer(JSON.stringify(valid), "length"), "incomplete_response"],
      [answer(null), "incomplete_response"],
    ]) {
      globalThis.fetch = async () => {
        calls++;
        return response;
      };
      await assert.rejects(
        () => interpretWithOpenRouter("fixture", {}),
        (e) =>
          e.category === category && e.trace.stage === "response_validation",
      );
    }
    assert.equal(calls, 4);
    globalThis.fetch = async () =>
      json({ error: { code: 429, message: "private-customer" } });
    await assert.rejects(
      () => interpretWithOpenRouter("fixture", {}),
      (e) =>
        e.status === 429 &&
        e.trace.httpStatus === 200 &&
        e.trace.origin === "upstream_payload",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("Application deadline aborts one native fetch and does not invent an HTTP 504", async (t) => {
  const original = globalThis.fetch;
  let ready,
    count = 0;
  const waiting = new Promise((r) => (ready = r));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    globalThis.fetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        count++;
        init.signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
        ready();
      });
    const response = interpretWithOpenRouter(
      "fixture",
      {},
      "fixture/model",
      "B",
      1000,
    );
    const rejection = assert.rejects(
      () => response,
      (e) =>
        e.category === "timeout" &&
        e.status === null &&
        e.trace.origin === "application_deadline" &&
        e.trace.deadlineMs === 1000,
    );
    await waiting;
    t.mock.timers.tick(1001);
    await rejection;
    assert.equal(count, 1);
  } finally {
    globalThis.fetch = original;
    t.mock.timers.reset();
  }
});
test("Catalog verification precedes quota; singleflight/cache are scoped to shop, model and credential", async () => {
  const original = globalThis.fetch;
  let generations = 0,
    quota = 0;
  const order = [];
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/models")) {
        order.push("catalog");
        return catalog("fixture/dedupe", "fixture/other");
      }
      order.push("generation");
      generations++;
      return answer();
    };
    const consume = async () => {
      order.push("quota");
      quota++;
    };
    const args = [
      "shop-1",
      "fixture-key",
      { question: "Resumo" },
      consume,
      "fixture/dedupe",
    ];
    const [a, b] = await Promise.all([
      cachedInterpretation(...args),
      cachedInterpretation(...args),
    ]);
    assert.equal(quota, 1);
    assert.equal(generations, 1);
    assert.equal(a.cacheHit, false);
    assert.equal(b.cacheHit, true);
    assert(a.trace.verifiedAt);
    assert.deepEqual(order, ["catalog", "quota", "generation"]);
    const hit = await cachedInterpretation(...args);
    assert.equal(hit.cacheHit, true);
    assert.equal(quota, 1);
    await cachedInterpretation("shop-2", ...args.slice(1));
    await cachedInterpretation("shop-1", "rotated-key", ...args.slice(2));
    await cachedInterpretation(
      "shop-1",
      "fixture-key",
      args[2],
      consume,
      "fixture/other",
    );
    assert.equal(quota, 4);
    assert.equal(generations, 4);
  } finally {
    globalThis.fetch = original;
  }
});
test("Unavailable or incompatible model never consumes daily quota or invokes generation", async () => {
  const original = globalThis.fetch;
  let quota = 0,
    generation = 0;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/models"))
        return json({
          data: [
            {
              id: "fixture/unsupported",
              supported_parameters: ["temperature"],
            },
          ],
        });
      generation++;
      return answer();
    };
    for (const [model, category] of [
      ["fixture/missing", "model_unavailable"],
      ["fixture/unsupported", "structured_response"],
    ])
      await assert.rejects(
        () =>
          cachedInterpretation(
            "model-fail",
            "fixture",
            {},
            async () => {
              quota++;
            },
            model,
          ),
        (e) => e.category === category && e.trace.stage === "model_catalog",
      );
    assert.equal(quota, 0);
    assert.equal(generation, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("402 has no retry; repeated identical clicks share failure cooldown; quota denial prevents POST", async () => {
  const original = globalThis.fetch;
  let quota = 0,
    generations = 0;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/models"))
        return catalog("fixture/credits", "fixture/quota");
      generations++;
      return json({ error: { code: 402, message: "fixture-secret" } }, 402);
    };
    for (let i = 0; i < 2; i++)
      await assert.rejects(
        () =>
          cachedInterpretation(
            "credits-shop",
            "fixture",
            {},
            async () => {
              quota++;
            },
            "fixture/credits",
          ),
        (e) => e.category === "insufficient_credits",
      );
    assert.equal(quota, 1);
    assert.equal(generations, 1);
    await assert.rejects(
      () =>
        cachedInterpretation(
          "quota-shop",
          "fixture",
          {},
          async () => {
            throw new AiFailure("app_quota");
          },
          "fixture/quota",
        ),
      (e) => e.category === "app_quota",
    );
    assert.equal(generations, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("Authenticated A–D diagnostic separates data stage, preserves quota gate and returns no secret", async () => {
  let code = ts.transpileModule(
    await fs.readFile("src/app/actions/ai-diagnostic-actions.ts", "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  ).outputText;
  code = code
    .replace(
      /import \{ AiFailure, safeAiDiagnostic, assertAiQuotaResult,?\s*\} from [^;]+;/,
      'import { AiFailure, safeAiDiagnostic, assertAiQuotaResult } from "./ai-errors.mjs";',
    )
    .replace(
      /import \{ resolveCurrentShop \} from [^;]+;/,
      "const resolveCurrentShop=(...args)=>globalThis.diagnosticFixture.auth(...args);",
    )
    .replace(
      /import \{ aiRuntime \} from [^;]+;/,
      'const aiRuntime=()=>({key:"fixture-private-key",source:"cloudflare_binding",contextAvailable:true,model:"fixture/model",timeoutMs:30000});',
    )
    .replace(
      /import \{ cachedInterpretation, aiDeadlineMs,?\s*\} from [^;]+;/,
      "const aiDeadlineMs=30000;const cachedInterpretation=(...args)=>globalThis.diagnosticFixture.cached(...args);",
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
  const { aiDiagnosticAction } = await import(
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
      assert.equal(model, "fixture/model");
      assert(["A", "B", "C", "D"].includes(profile));
      assert(!JSON.stringify(aggregate).includes("must-not-leak"));
      await consume();
      providerCalls++;
      return { trace: { stage: "complete", durationMs: 1 } };
    },
  };
  globalThis.diagnosticFixture = fixture;
  try {
    const metadata = await aiDiagnosticAction();
    assert(metadata.ok);
    assert.equal(quota, 0);
    for (const profile of ["A", "B", "C", "D"]) {
      const r = await aiDiagnosticAction(true, profile);
      assert(r.ok);
      assert.equal(r.timing.profile, profile);
      assert(!JSON.stringify(r).includes("fixture-private-key"));
    }
    assert.equal(reads, 2);
    assert.equal(providerCalls, 4);
    assert.equal(quota, 4);
    allowed = false;
    const rejected = await aiDiagnosticAction(true, "A");
    assert.equal(rejected.category, "app_quota");
    assert.equal(providerCalls, 4);
    dataFails = true;
    const dataFailure = await aiDiagnosticAction(true, "C");
    assert.equal(dataFailure.category, "data_query");
    assert.equal(dataFailure.timing.stage, "supabase_aggregate");
    assert.equal(quota, 5);
    assert(!JSON.stringify(dataFailure).includes("sensitive provider text"));
    authorized = false;
    const denied = await aiDiagnosticAction(true, "A");
    assert.equal(denied.category, "authorization");
    assert.equal(quota, 5);
  } finally {
    delete globalThis.diagnosticFixture;
  }
});

test("Native fetch preserves all HTTP failure categories without retry or leaking provider body", async () => {
  const original = globalThis.fetch,
    warn = console.warn,
    logs = [];
  let calls = 0;
  try {
    console.warn = (...args) => logs.push(args.join(" "));
    for (const [status, category] of [
      [401, "invalid_key"],
      [402, "insufficient_credits"],
      [408, "request_timeout"],
      [429, "rate_limit"],
      [502, "bad_gateway"],
      [503, "provider_unavailable"],
      [504, "gateway_timeout"],
    ]) {
      globalThis.fetch = async () => {
        calls++;
        return json(
          {
            error: {
              code: status,
              message: "private-provider-text fixture-key",
            },
          },
          status,
        );
      };
      await assert.rejects(
        () => interpretWithOpenRouter("fixture-key", {}, "fixture/model"),
        (e) =>
          e.category === category &&
          e.status === status &&
          e.trace.httpStatus === status &&
          e.trace.origin === "upstream_http",
      );
    }
    assert.equal(calls, 7);
    assert(!logs.join().includes("private-provider-text"));
    assert(!logs.join().includes("fixture-key"));
  } finally {
    globalThis.fetch = original;
    console.warn = warn;
  }
});

test("Quota RPC accepts only a boolean and distinguishes RLS, missing function and contract errors", () => {
  assert.doesNotThrow(() => assertAiQuotaResult(true, null));
  for (const value of [null, [], {}, "true", 1])
    assert.throws(
      () => assertAiQuotaResult(value, null),
      (e) => e.category === "quota_contract",
    );
  assert.throws(
    () => assertAiQuotaResult(false, null),
    (e) => e.category === "app_quota",
  );
  for (const [code, category] of [
    ["42501", "quota_forbidden"],
    ["PGRST202", "quota_missing"],
    ["42883", "quota_missing"],
    ["PGRST301", "authorization"],
    ["XX000", "quota_check"],
  ])
    assert.throws(
      () => assertAiQuotaResult(null, { code }),
      (e) => e.category === category && e.rpcCode === code,
    );
});
test("Known free-router misconfiguration is corrected without a paid fallback or static catalog dependency", async () => {
  const original = globalThis.fetch;
  let calls = 0,
    quota = 0,
    body;
  const old = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_MODEL = "openrouter/auto:free";
  try {
    const runtime = aiRuntime();
    assert.equal(runtime.model, "openrouter/free");
    assert.equal(runtime.modelAdjusted, true);
    globalThis.fetch = async (url, init) => {
      calls++;
      assert(String(url).endsWith("/chat/completions"));
      assert.equal(init.redirect, "manual");
      body = JSON.parse(init.body);
      return answer();
    };
    await cachedInterpretation(
      "free-router-fixture",
      "fixture",
      {},
      async () => {
        quota++;
      },
      runtime.model,
      "B",
    );
    assert.equal(body.model, "openrouter/free");
    assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(calls, 1);
    assert.equal(quota, 1);
  } finally {
    globalThis.fetch = original;
    if (old === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = old;
  }
});
test("Redirect is refused without following Location and unknown preflight exceptions have precise stage", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.invalid/steal" },
      });
    };
    await assert.rejects(
      () => interpretWithOpenRouter("fixture", {}, "fixture/model"),
      (e) => e.category === "provider_redirect" && e.status === 302,
    );
    assert.equal(calls, 1);
    const stages = [];
    await assert.rejects(
      () =>
        cachedInterpretation(
          "stage-fixture",
          "fixture",
          {},
          async () => {
            throw new TypeError("private-fixture-error");
          },
          "openrouter/free",
          "A",
          30000,
          (s) => stages.push(s),
        ),
      (e) =>
        e.category === "quota_check" &&
        e.exceptionType === "TypeError" &&
        e.trace.stage === "supabase_quota" &&
        !JSON.stringify(safeAiDiagnostic(e)).includes("private-fixture-error"),
    );
    assert(stages.includes("cache_digest"));
    assert(stages.includes("model_router"));
    assert(stages.includes("supabase_quota"));
  } finally {
    globalThis.fetch = original;
  }
});

test("Supabase transport failure is a quota/database error, never an OpenRouter connectivity error", async () => {
  await assert.rejects(
    () =>
      cachedInterpretation(
        "db-network-fixture",
        "fixture",
        {},
        async () => {
          throw new TypeError("fetch failed");
        },
        "openrouter/free",
        "A",
      ),
    (e) =>
      e.category === "quota_check" &&
      e.trace.stage === "supabase_quota" &&
      e.exceptionType === "TypeError" &&
      !e.message.includes("alcançar a API OpenRouter"),
  );
});
