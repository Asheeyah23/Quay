// Refunds: money a seller sends back to someone who paid one of their links.
//
// A refund belongs to a payment, not to a link. A link can be paid by several
// payers in several operations (split payments and top-ups, issue 1.4), each
// recorded as its own `LinkPaymentRecord`, so "refund this link" does not say
// whose money goes back. Every refund names the payment operation it returns,
// by `paymentTxHash` + `paymentOperationId`, and is capped by that payment.
//
// There are no refund states in `LINK_STATUSES` (status.ts), on purpose:
//
//  - The link's machine describes a buyer paying and a seller cashing out.
//    `paid` leads only to `offramp_pending`, and `offramp_settled`, `expired`
//    and `cancelled` are terminal. A seller may have to refund at any of
//    those points, also after a cash-out has settled, so a refund is not a
//    step on that path. A `refunded` link status would have to be reachable
//    from terminal states, and it would overwrite whether the link had been
//    cashed out.
//  - A refund is often partial (the overpaid part of a payment is the most
//    common case), and one link can have several, in different states at the
//    same moment. One status field on the link cannot say that.
//
// So a refund has its own small machine, below, and what a link shows about
// its refunds ("Refunded", "Part refunded") is worked out from the refunds
// by `linkRefundSummary`. `LinkStatus` stays as it is.

import type { AssetRef } from "./payment-link";

export const REFUND_STATUSES = [
  "prepared", // an unsigned transaction was built for the seller to sign
  "submitted", // Horizon accepted the signed transaction; its hash is known
  "confirmed", // the refund is on the ledger
  "failed", // it never got there: its time bounds passed unsigned, or the transaction failed
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

const REFUND_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  // Signed and accepted, or its time bounds passed before it was.
  prepared: ["submitted", "failed"],
  submitted: ["confirmed", "failed"],
  confirmed: [],
  failed: [],
};

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from].includes(to);
}

export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  if (!canTransitionRefund(from, to)) {
    throw new Error(`Illegal refund status transition: ${from} -> ${to}`);
  }
}

export function isRefundTerminal(status: RefundStatus): boolean {
  return REFUND_TRANSITIONS[status].length === 0;
}

/** How the refund transaction's memo is encoded, when it carries one. */
export type RefundMemoType = "text" | "id" | "hash";

export interface Refund {
  id: string;
  linkId: string;
  sellerId: string;
  /** The payment this refund returns: `LinkPaymentRecord.txHash`... */
  paymentTxHash: string;
  /** ...and `LinkPaymentRecord.operationId`. One transaction can carry more
   *  than one payment to a link, so the hash alone does not name a payment. */
  paymentOperationId: string;
  /** G-address the refund is sent to. */
  destination: string;
  /** SEP-23 muxed id when the refund goes to a muxed account of `destination`. */
  destinationMuxedId: string | null;
  /** Memo the destination needs to credit the refund, such as an exchange's
   *  deposit memo. `memoType` says how to encode it; both are null together. */
  memo: string | null;
  memoType: RefundMemoType | null;
  /** Amount sent back, a canonical decimal string in `asset`. */
  amount: string;
  asset: AssetRef;
  status: RefundStatus;
  /** Hash of the refund transaction; null while the refund is `prepared`. */
  txHash: string | null;
  /** Why the refund failed; null unless it is `failed`. */
  failureReason: string | null;
  createdAt: number; // epoch ms
  updatedAt: number;
}
