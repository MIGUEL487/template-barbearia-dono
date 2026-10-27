import crypto from "node:crypto";
export function verifyPaymentSignature(
  signature: string | null,
  requestId: string | null,
  id: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!signature || !requestId || !secret || !/^\d+$/.test(id)) return false;
  const ts = signature.match(/(?:^|,)\s*ts=(\d+)(?:,|$)/)?.[1];
  const hash = signature.match(/(?:^|,)\s*v1=([a-f0-9]{64})(?:,|$)/i)?.[1];
  if (!ts || !hash) return false;
  const epoch = Number(ts) * (ts.length <= 10 ? 1000 : 1);
  if (!Number.isSafeInteger(epoch) || Math.abs(now - epoch) > 300000)
    return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest();
  const received = Buffer.from(hash, "hex");
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(expected, received)
  );
}
