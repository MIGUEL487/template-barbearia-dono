import { test } from "node:test";
import assert from "node:assert/strict";
import { readAll } from "../src/lib/saas2/pagination.ts";
test("API page cap smaller than 1000 never truncates financial totals", async () => {
  const records = Array.from({ length: 421 }, (_, id) => ({ id })),
    calls = [];
  const result = await readAll(async (from, to) => {
    calls.push(from);
    return {
      data: records.slice(from, Math.min(to + 1, from + 200)),
      error: null,
    };
  });
  assert.equal(result.length, 421);
  assert.deepEqual(calls, [0, 200, 400, 421]);
  assert.equal(
    result.reduce((n, r) => n + r.id, 0),
    88410,
  );
});
test("hard limit and database errors fail instead of returning partial totals", async () => {
  await assert.rejects(
    () => readAll(async () => ({ data: [{ id: 1 }], error: null }), 2),
    /limite seguro/,
  );
  await assert.rejects(
    () =>
      readAll(async () => ({
        data: null,
        error: { message: "database fixture failed" },
      })),
    /database fixture failed/,
  );
  await assert.rejects(
    () => readAll(async () => ({ data: { unexpected: true }, error: null })),
    /inválida/,
  );
});
test("empty database remains a real empty result", async () =>
  assert.deepEqual(await readAll(async () => ({ data: [], error: null })), []));
