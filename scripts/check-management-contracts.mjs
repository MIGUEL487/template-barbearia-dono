// Read-only comparison of database/action calls before and after the presentation rewrite.
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";
const base = "45cbd1ba1dfaca1c79ec1863f174514ee7b6b5b9";
const files = [
  "dashboard",
  "agenda",
  "clientes",
  "servicos",
  "equipe",
  "configuracoes",
]
  .map((p) => `src/app/${p}/page.tsx`)
  .concat(["src/components/saas2/rescue-page.tsx","src/app/equipe/use-team-manager.tsx"]);
const printer = ts.createPrinter({ removeComments: true });
function calls(source) {
  const ast = ts.createSourceFile(
      "page.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    result = [];
  function walk(n) {
    if (
      ts.isCallExpression(n) &&
      ((ts.isPropertyAccessExpression(n.expression) &&
        [
          "from",
          "select",
          "rpc",
          "insert",
          "update",
          "upsert",
          "delete",
        ].includes(n.expression.name.text)) ||
        (ts.isIdentifier(n.expression) && /Action$/.test(n.expression.text)))
    )
      result.push(
        printer.printNode(ts.EmitHint.Unspecified, n, ast).replace(/\s+/g, ""),
      );
    ts.forEachChild(n, walk);
  }
  walk(ast);
  return result.sort();
}
const results = [];
for (const file of files) {
  const old = calls(
      execFileSync("git", ["show", base + ":" + file], { encoding: "utf8" }),
    ),
    current = calls(fs.readFileSync(file, "utf8"));
  if (JSON.stringify(old) !== JSON.stringify(current))
    throw Error("Data/action contract changed: " + file);
  results.push({
    file,
    calls: current.length,
    unchanged: true,
    hash: crypto
      .createHash("sha256")
      .update(JSON.stringify(current))
      .digest("hex"),
  });
}
console.log(JSON.stringify({ base, results }, null, 2));
