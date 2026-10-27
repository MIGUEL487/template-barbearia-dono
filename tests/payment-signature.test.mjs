import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyPaymentSignature } from "../src/lib/payment-signature.ts";
const secret = "local-test-fixture-only",
  id = "12345",
  requestId = "fixture-request",
  now = 1700000000000,
  ts = String(now / 1000);
const hash = crypto
  .createHmac("sha256", secret)
  .update(`id:${id};request-id:${requestId};ts:${ts};`)
  .digest("hex");
test("accepts valid HMAC for correct manifest", () =>
  assert.equal(
    verifyPaymentSignature(`ts=${ts},v1=${hash}`, requestId, id, secret, now),
    true,
  ));
test("rejects modified payment, forged HMAC, missing headers and path injection", () => {
  for (const [sig, req, pid] of [
    [`ts=${ts},v1=${hash}`, requestId, "99"],
    [`ts=${ts},v1=${"0".repeat(64)}`, requestId, id],
    [null, requestId, id],
    [`ts=${ts},v1=${hash}`, null, id],
    [`ts=${ts},v1=${hash}`, requestId, "../../admin"],
  ])
    assert.equal(verifyPaymentSignature(sig, req, pid, secret, now), false);
});
test("rejects stale timestamp replay and malformed signatures", () => {
  assert.equal(
    verifyPaymentSignature(
      `ts=${ts},v1=${hash}`,
      requestId,
      id,
      secret,
      now + 300001,
    ),
    false,
  );
  assert.equal(
    verifyPaymentSignature(`ts=${ts},v1=bad`, requestId, id, secret, now),
    false,
  );
});
