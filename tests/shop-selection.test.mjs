import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const dir = await fs.mkdtemp(path.resolve(".qa-shop-"));
await fs.writeFile(
  path.join(dir, "selection.mjs"),
  ts.transpileModule(await fs.readFile("src/lib/shop-selection.ts", "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText,
);
const { selectMembership } = await import(
  pathToFileURL(path.join(dir, "selection.mjs"))
);
after(() => fs.rm(dir, { recursive: true, force: true }));
test("tenant selection never requires an env ID or guesses between stores", () => {
  const a = { barbershop_id: "a" },
    b = { barbershop_id: "b" };
  assert.equal(selectMembership([a]).barbershop_id, "a");
  assert.throws(() => selectMembership([]), /sem vínculo/);
  assert.throws(() => selectMembership([a, b]), /Selecione/);
  assert.throws(() => selectMembership([a], "foreign"), /Acesso negado/);
  assert.equal(selectMembership([a, b], "b"), b);
});
