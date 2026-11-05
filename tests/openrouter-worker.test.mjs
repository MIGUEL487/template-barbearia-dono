import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("Real workerd reproduces legacy redirect TypeError and verifies fixed native HTTP, schema, free routing and quota", async () => {
  const dir = await fs.mkdtemp(path.resolve(".qa-workerd-"));
  const counts = { catalog: 0, generation: 0, leaked: 0 };
  let lastBody;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/leak") {
      counts.leaked++;
      res.end("{}");
      return;
    }
    if (req.url === "/models") {
      counts.catalog++;
      res.end(
        JSON.stringify({
          data: [
            {
              id: "fixture/worker:free",
              supported_parameters: ["structured_outputs"],
              pricing: { prompt: "0", completion: "0" },
            },
          ],
        }),
      );
      return;
    }
    let text = "";
    for await (const c of req) text += c;
    const body = JSON.parse(text);
    lastBody = body;
    counts.generation++;
    assert.equal(req.headers.authorization, "Bearer fixture-only-key");
    if (JSON.stringify(body.messages).includes("redirect-fixture")) {
      res.statusCode = 302;
      res.setHeader("Location", "/leak");
      res.end("{}");
      return;
    }
    const value = {
      resumo: "Resposta estruturada do provedor HTTP local.",
      pontos_positivos: [],
      pontos_de_atencao: [],
      sugestoes: [],
      prioridade: "normal",
    };
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: body.response_format ? JSON.stringify(value) : "OK",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 8,
          total_tokens: 13,
          cost: 0,
        },
      }),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const api = `http://127.0.0.1:${server.address().port}`;
  const sourcePath = path.resolve("src/lib/saas2/openrouter.ts"),
    errorsPath = path.resolve("src/lib/saas2/ai-errors.ts");
  const worker = `import {cachedInterpretation} from ${JSON.stringify(sourcePath)};import {AiFailure,assertAiQuotaResult,safeAiDiagnostic} from ${JSON.stringify(errorsPath)};
 let calls=0;export default {async fetch(req){if(req.headers.get('x-fixture-session')!=='owner-fixture')return Response.json({error:'unauthorized'},{status:401});const u=new URL(req.url);let stage='authorization';try{const result=await cachedInterpretation('11111111-1111-1111-1111-111111111111','fixture-only-key',{question:u.searchParams.get('q')||'Resumo'},async()=>{assertAiQuotaResult(calls<5,null);calls++;},u.searchParams.get('model')||'fixture/worker:free',u.searchParams.get('profile')||'A',3000,s=>stage=s);return Response.json({ok:true,calls,stage,summary:result.summary,cacheHit:result.cacheHit});}catch(e){return Response.json({ok:false,calls,stage,...safeAiDiagnostic(e)});}}};`;
  async function runtime(legacy) {
    const out = await build({
      stdin: {
        contents: worker,
        resolveDir: process.cwd(),
        sourcefile: "worker-test.mjs",
      },
      bundle: true,
      format: "esm",
      platform: "neutral",
      write: false,
      plugins: [
        {
          name: "fixture-only",
          setup(b) {
            b.onResolve({ filter: /^server-only$/ }, () => ({
              path: "empty",
              namespace: "fixture",
            }));
            b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
              contents: "",
              loader: "js",
            }));
            b.onLoad(
              { filter: /src\/lib\/saas2\/openrouter\.ts$/ },
              async () => {
                let s = await fs.readFile(sourcePath, "utf8");
                s = s.replace(
                  'const api = "https://openrouter.ai/api/v1";',
                  `const api = ${JSON.stringify(api)};`,
                );
                if (legacy)
                  s = s.replaceAll('redirect: "manual"', 'redirect: "error"');
                return {
                  contents: s,
                  loader: "ts",
                  resolveDir: path.dirname(sourcePath),
                };
              },
            );
          },
        },
      ],
    });
    return new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: out.outputFiles[0].text,
        compatibilityDate: "2026-10-27",
        compatibilityFlags: ["nodejs_compat"],
      }),
    );
  }
  let legacy, fixed;
  const evidence = {
    runtime: "workerd",
    compatibilityDate: "2026-10-27",
    externalCalls: 0,
  };
  try {
    legacy = await runtime(true);
    const before = await (
      await legacy.dispatchFetch("http://fixture/probe", {
        headers: { "x-fixture-session": "owner-fixture" },
      })
    ).json();
    assert.equal(before.ok, false);
    assert.equal(before.category, "runtime_incompatible");
    assert.equal(before.exceptionType, "TypeError");
    assert.equal(before.trace.stage, "model_catalog");
    assert.equal(before.trace.httpStatus, null);
    assert.equal(before.calls, 0);
    assert.deepEqual(counts, { catalog: 0, generation: 0, leaked: 0 });
    evidence.before = before;
    await legacy.dispose();
    legacy = null;
    fixed = await runtime(false);
    assert.equal(
      (await fixed.dispatchFetch("http://fixture/probe")).status,
      401,
    );
    async function probe(query) {
      return (
        await fixed.dispatchFetch("http://fixture/probe?" + query, {
          headers: { "x-fixture-session": "owner-fixture" },
        })
      ).json();
    }
    const minimal = await probe("q=minimum");
    assert.equal(minimal.ok, true);
    assert.equal(minimal.calls, 1);
    assert.equal(counts.catalog, 1);
    assert.equal(counts.generation, 1);
    const reused = await probe("q=minimum");
    assert.equal(reused.ok, true);
    assert.equal(reused.cacheHit, true);
    assert.equal(reused.calls, 1);
    const structured = await probe("q=structured&profile=B");
    assert.equal(structured.ok, true);
    assert.equal(
      structured.summary,
      "Resposta estruturada do provedor HTTP local.",
    );
    assert.equal(structured.calls, 2);
    const free = await probe("q=free&profile=B&model=openrouter%2Fauto%3Afree");
    assert.equal(free.ok, true);
    assert.equal(lastBody.model, "openrouter/free");
    assert.deepEqual(lastBody.provider.max_price, { prompt: 0, completion: 0 });
    assert.equal(counts.catalog, 1);
    const redirect = await probe("q=redirect-fixture&profile=B");
    assert.equal(redirect.category, "provider_redirect");
    assert.equal(redirect.trace.httpStatus, 302);
    assert.equal(counts.leaked, 0);
    assert.equal(redirect.calls, 4);
    const fifth = await probe("q=fifth&profile=B");
    assert.equal(fifth.ok, true);
    assert.equal(fifth.calls, 5);
    const generations = counts.generation;
    const denied = await probe("q=sixth&profile=B");
    assert.equal(denied.category, "app_quota");
    assert.equal(denied.calls, 5);
    assert.equal(counts.generation, generations);
    assert.equal(counts.leaked, 0);
    evidence.after = {
      minimum: minimal,
      structured,
      free,
      redirect,
      quotaDenied: denied,
      counts,
    };
    if (process.env.QA_WORKER_EVIDENCE)
      await fs.writeFile(
        process.env.QA_WORKER_EVIDENCE,
        JSON.stringify(evidence, null, 2) + "\n",
      );
  } finally {
    await legacy?.dispose();
    await fixed?.dispose();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
