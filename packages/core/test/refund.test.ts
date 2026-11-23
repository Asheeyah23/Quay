import { describe, it, expect } from "vitest";
import {
  REFUND_STATUSES,
  assertRefundTransition,
  canTransitionRefund,
  isRefundTerminal,
  type RefundStatus,
} from "../src/domain/refund";
import { LINK_STATUSES } from "../src/domain/status";
import * as core from "../src/index";

describe("refund status transitions", () => {
  // The whole table, written out: a transition is legal only if it is here.
  const LEGAL: ReadonlyArray<readonly [RefundStatus, RefundStatus]> = [
    ["prepared", "submitted"],
    ["prepared", "failed"],
    ["submitted", "confirmed"],
    ["submitted", "failed"],
  ];
  const isLegal = (from: RefundStatus, to: RefundStatus) => LEGAL.some(([f, t]) => f === from && t === to);

  it("has exactly these four statuses, in this order", () => {
    expect([...REFUND_STATUSES]).toEqual(["prepared", "submitted", "confirmed", "failed"]);
  });

  for (const from of REFUND_STATUSES) {
    for (const to of REFUND_STATUSES) {
      const legal = isLegal(from, to);
      it(`${legal ? "allows" : "forbids"} ${from} -> ${to}`, () => {
        expect(canTransitionRefund(from, to)).toBe(legal);
        if (legal) {
          expect(() => assertRefundTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertRefundTransition(from, to)).toThrow(
            `Illegal refund status transition: ${from} -> ${to}`,
          );
        }
      });
    }
  }

  it("counts sixteen pairs, four of them legal", () => {
    const pairs = REFUND_STATUSES.flatMap((from) => REFUND_STATUSES.map((to) => [from, to] as const));
    expect(pairs).toHaveLength(16);
    expect(pairs.filter(([from, to]) => canTransitionRefund(from, to))).toEqual(LEGAL);
  });

  it("has confirmed and failed as its only terminal statuses", () => {
    expect(REFUND_STATUSES.filter(isRefundTerminal)).toEqual(["confirmed", "failed"]);
    for (const terminal of ["confirmed", "failed"] as const) {
      for (const to of REFUND_STATUSES) {
        expect(canTransitionRefund(terminal, to)).toBe(false);
      }
    }
  });

  it("does not let a refund skip being submitted, or go back", () => {
    expect(canTransitionRefund("prepared", "confirmed")).toBe(false);
    expect(canTransitionRefund("submitted", "prepared")).toBe(false);
  });
});

describe("link statuses", () => {
  it("are unchanged: a refund is not a link status", () => {
    expect([...LINK_STATUSES]).toEqual([
      "active",
      "paid",
      "underpaid",
      "expired",
      "cancelled",
      "offramp_pending",
      "offramp_settled",
      "offramp_failed",
    ]);
    expect(LINK_STATUSES.some((status) => status.includes("refund"))).toBe(false);
  });
});

describe("the package's exports", () => {
  it("include the refund model", () => {
    expect(core.REFUND_STATUSES).toBe(REFUND_STATUSES);
    expect(core.canTransitionRefund).toBe(canTransitionRefund);
    expect(core.assertRefundTransition).toBe(assertRefundTransition);
  });
});
