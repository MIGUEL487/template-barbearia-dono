import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const dir = await fs.mkdtemp(path.resolve(".qa-gemini-"));
for (const [name, src] of [
  ["selection", "shop-selection"],
  ["gemini", "saas2/gemini"],
  ["gemini-errors", "saas2/gemini-errors"],
]) {
  await fs.writeFile(
    path.join(dir, name + ".mjs"),
    ts.transpileModule(await fs.readFile("src/lib/" + src + ".ts", "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText.replace(/(["'])\.\/gemini-errors\1/g,'"./gemini-errors.mjs"'),
  );
}
const { selectMembership } = await import(
    pathToFileURL(path.join(dir, "selection.mjs"))
  ),
  { interpretWithGemini, cachedInterpretation } = await import(
    pathToFileURL(path.join(dir, "gemini.mjs"))
  );
test("tenant selection never requires an env ID or guesses between stores", () => {
  const a = { barbershop_id: "a" },
    b = { barbershop_id: "b" };
  assert.equal(selectMembership([a]).barbershop_id, "a");
  assert.throws(() => selectMembership([]), /sem vínculo/);
  assert.throws(() => selectMembership([a, b]), /Selecione/);
  assert.throws(() => selectMembership([a], "foreign"), /Acesso negado/);
  assert.equal(selectMembership([a, b], "b"), b);
});
test("Gemini structured output, failures, quota and dedupe without live calls", async () => {
  const original = globalThis.fetch;
  let count = 0;
  const valid = {
    resumo: "Recebimentos registrados.",
    pontos_positivos: [],
    pontos_de_atencao: ["Confirmar pré-reservas."],
    sugestoes: [],
    prioridade: "normal",
  };
  try {
    globalThis.fetch = async () => {
      count++;
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
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const aggregate = { date: "2026-11-04", receivedCents: 0 };
    const r = await interpretWithGemini("fixture-key", aggregate);
    assert.equal(r.summary, valid.resumo);
    let quota = 0;
    await Promise.all([
      cachedInterpretation("shop1", "fixture", aggregate, async () => {
        quota++;
      }),
      cachedInterpretation("shop1", "fixture", aggregate, async () => {
        quota++;
      }),
    ]);
    assert.equal(quota, 1);
    await cachedInterpretation("shop2", "fixture", aggregate, async () => {
      quota++;
    });
    assert.equal(quota, 2);
    await assert.rejects(
      () =>
        cachedInterpretation("quota", "fixture", aggregate, async () => {
          throw Error("Limite diário");
        }),
      /Limite/,
    );
    for (const status of [400, 401, 429, 503]) {
      globalThis.fetch = async () => new Response("{}", { status });
      await assert.rejects(
        () => interpretWithGemini("invalid-fixture", aggregate),
        /indisponível/,
      );
    }
    globalThis.fetch = async () => {
      throw Error("timeout fixture");
    };
    await assert.rejects(
      () => interpretWithGemini("fixture", aggregate),
      /indisponível/,
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: '{"unexpected":true}' }] } },
          ],
        }),
      );
    await assert.rejects(
      () => interpretWithGemini("fixture", aggregate),
      /inválida/,
    );
    assert(count >= 3);
  } finally {
    globalThis.fetch = original;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
