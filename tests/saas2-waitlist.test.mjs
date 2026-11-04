import { test } from "node:test";
import assert from "node:assert/strict";
import { waitlistState } from "../src/lib/saas2/waitlist.ts";
const now = Date.parse("2026-11-04T15:00Z"),
  base = { status: "offered", offer_expires_at: "2026-11-04T14:00Z" };
test("confirmed/completed booking never re-enters queue after original hold expiration", () => {
  for (const status of ["confirmed", "completed"]) {
    const s = waitlistState(
      {
        ...base,
        offered_booking: { status, hold_expires_at: base.offer_expires_at },
      },
      now,
    );
    assert.equal(s.canOffer, false);
    assert.equal(s.canRemove, false);
    assert(!s.label.includes("encerrada"));
  }
});
test("expired or cancelled offers may be re-evaluated, active hold remains blocked", () => {
  assert.equal(
    waitlistState(
      {
        ...base,
        offered_booking: {
          status: "hold",
          hold_expires_at: "2026-11-04T15:15Z",
        },
      },
      now,
    ).canOffer,
    false,
  );
  assert.equal(waitlistState(base, now).canOffer, true);
  assert.equal(
    waitlistState(
      {
        ...base,
        offered_booking: { status: "cancelled", hold_expires_at: null },
      },
      now,
    ).canOffer,
    true,
  );
});
test("cancelled requests stay removed and waiting requests may be offered", () => {
  assert.equal(
    waitlistState({ ...base, status: "cancelled" }, now).canOffer,
    false,
  );
  assert.equal(
    waitlistState({ ...base, status: "waiting" }, now).canOffer,
    true,
  );
});
