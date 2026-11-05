import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const dir = await fs.mkdtemp(path.resolve(".qa-saas3-"));
for (const [name, source] of [
  ["money", "saas2/money"],
  ["analytics", "saas2/analytics"],
  ["pagination", "saas2/pagination"],
  ["ledger", "saas3/ledger"],
  ["questions", "saas3/questions"],
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
    .replace(/(["'])\.\/money\1/g, '"./money.mjs"')
    .replace(/(["'])@\/lib\/saas2\/analytics\1/g, '"./analytics.mjs"')
    .replace(/(["'])@\/lib\/saas2\/pagination\1/g, '"./pagination.mjs"');
  await fs.writeFile(path.join(dir, name + ".mjs"), code);
}
const { brazilMoney, safeCsv, settled } = await import(
    pathToFileURL(path.join(dir, "ledger.mjs"))
  ),
  { questionRange, cleanQuestion } = await import(
    pathToFileURL(path.join(dir, "questions.mjs"))
  );
test("Brazilian amounts are exact; malformed input is rejected", () => {
  assert.equal(brazilMoney("1.234,56"), 1234.56);
  assert.equal(brazilMoney("19,99"), 19.99);
  for (const v of ["-10", "0", "1,234", "50.00", "NaN", "100000000"])
    assert.throws(() => brazilMoney(v));
  assert.equal(safeCsv("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(settled({ entry_status: "pending" }), false);
  assert.equal(settled({ entry_status: "void" }), false);
  assert.equal(settled({}), true);
});
test("questions resolve explicit Sao Paulo periods and scoped followups", () => {
  assert.equal(
    questionRange("Quantos clientes amanhã?", "2026-11-04").start,
    "2026-11-05",
  );
  assert.equal(
    questionRange("Quanto faturei esta semana?", "2026-11-04").start,
    "2026-11-02",
  );
  assert.equal(
    questionRange("semana anterior", "2026-11-04").end,
    "2026-11-01",
  );
  assert.equal(
    questionRange("despesas", "2026-11-04", {
      start: "2026-10-01",
      end: "2026-10-31",
    }).start,
    "2026-10-01",
  );
  assert.equal(
    questionRange("agenda 29/10/2026", "2026-11-04").end,
    "2026-10-29",
  );
  assert(
    !cleanQuestion("Fale com nome@example.test 11999999999").includes(
      "nome@example.test",
    ),
  );
});
import { after } from "node:test";
after(() => fs.rm(dir, { recursive: true, force: true }));
