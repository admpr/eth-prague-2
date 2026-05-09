import assert from "node:assert/strict";
import test from "node:test";
import type { Hash } from "viem";
import {
  SUBMITTED_TRANSACTION_RECEIPT_POLLING_INTERVAL_MS,
  SUBMITTED_TRANSACTION_RECEIPT_TIMEOUT_MS,
  waitForSubmittedTransactionReceipt,
  type SubmittedTransactionReceiptClient,
} from "./rpc";

test("waits for submitted transaction receipts without replacement detection", async () => {
  const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash;
  const receipt = { status: "success" };
  let capturedParameters: unknown;
  const client: SubmittedTransactionReceiptClient = {
    waitForTransactionReceipt: async (parameters) => {
      capturedParameters = parameters;
      return receipt as Awaited<ReturnType<SubmittedTransactionReceiptClient["waitForTransactionReceipt"]>>;
    },
  };

  const result = await waitForSubmittedTransactionReceipt({ hash, client });

  assert.equal(result, receipt);
  assert.deepEqual(capturedParameters, {
    hash,
    pollingInterval: SUBMITTED_TRANSACTION_RECEIPT_POLLING_INTERVAL_MS,
    timeout: SUBMITTED_TRANSACTION_RECEIPT_TIMEOUT_MS,
    checkReplacement: false,
  });
});
