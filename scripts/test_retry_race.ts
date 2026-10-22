/**
 * Retry race guard. This exercises the real submitOnce module in plain Node with no
 * browser and no network, and asserts the one property the reviewer asked for: after a
 * client side error on a write, the transaction layer never submits a second time.
 *
 * Run through esbuild so it works on the CI Node version:
 *   esbuild scripts/test_retry_race.ts --bundle --platform=node --format=esm \
 *     --outfile=artifacts/retry_race_test.mjs && node artifacts/retry_race_test.mjs
 */

import assert from "node:assert/strict";
import {
  AmbiguousSubmissionError,
  submitOnce,
  type PendingRecord,
  type PendingStore,
  type ReceiptOutcome,
} from "../frontend/src/lib/submitOnce.ts";

function makeStore(seed?: Record<string, PendingRecord>): PendingStore {
  const map: Record<string, PendingRecord> = { ...(seed ?? {}) };
  return {
    get: (key) => map[key] ?? null,
    set: (key, record) => {
      map[key] = record;
    },
    clear: (key) => {
      delete map[key];
    },
    list: () => Object.keys(map).map((key) => ({ key, record: map[key] })),
  };
}

const finalized: ReceiptOutcome = { status: "FINALIZED", execution: "SUCCESS", returned: { ok: 1 } };
const HASH = "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123ab";

let checks = 0;
function pass(name: string) {
  checks += 1;
  console.log(`ok  - ${name}`);
}

async function testHappyPath() {
  let submits = 0;
  let watches = 0;
  const store = makeStore();
  const result = await submitOnce({
    key: "wallet:create_campaign",
    functionName: "create_campaign",
    submit: async () => {
      submits += 1;
      return HASH;
    },
    watch: async () => {
      watches += 1;
      return finalized;
    },
    store,
  });
  assert.equal(submits, 1);
  assert.equal(watches, 1);
  assert.equal(result.outcome.execution, "SUCCESS");
  assert.equal(store.list().length, 0, "resolved submission must clear the pending slot");
  pass("happy path submits once and clears the pending slot");
}

async function testClientErrorAfterWriteNeverResubmits() {
  // The write landed on chain (submit returned a hash) but the client side watch then
  // errored. A second attempt must resume the SAME hash, never submit again.
  let submits = 0;
  let watchCalls = 0;
  const store = makeStore();
  const flakyWatch = async (): Promise<ReceiptOutcome> => {
    watchCalls += 1;
    if (watchCalls === 1) throw new Error("RPC connection reset after submit");
    return finalized;
  };
  const base = {
    key: "wallet:submit",
    functionName: "accept_and_submit_deliverable",
    campaignId: 7,
    submit: async () => {
      submits += 1;
      return HASH;
    },
    watch: flakyWatch,
    store,
  };
  const first = await submitOnce(base);
  assert.equal(submits, 1, "the landed write must be submitted exactly once");
  assert.equal(first.outcome.status, "PENDING", "a watch error keeps the known hash pending");
  assert.equal(first.resumed, false);
  assert.equal(store.list().length, 1, "the pending hash survives so a reload can resume");

  const second = await submitOnce(base);
  assert.equal(submits, 1, "resuming after a client error must NOT submit a second time");
  assert.equal(second.resumed, true, "the retry goes through the resume path");
  assert.equal(second.hash, HASH, "the same hash is reused");
  assert.equal(second.outcome.execution, "SUCCESS", "the real landed result is shown");
  assert.equal(store.list().length, 0);
  pass("client error after a successful write resumes the same hash, never resubmits");
}

async function testReloadResumesStoredHash() {
  // A fresh page load where the pending store already holds a hash from before reload.
  let submits = 0;
  let watchHash = "";
  const store = makeStore({
    "wallet:verify": { hash: HASH, functionName: "verify_campaign_deliverable_live", campaignId: 3, startedAt: 1 },
  });
  const result = await submitOnce({
    key: "wallet:verify",
    functionName: "verify_campaign_deliverable_live",
    campaignId: 3,
    submit: async () => {
      submits += 1;
      return "0xshouldneverhappen";
    },
    watch: async (hash) => {
      watchHash = hash;
      return finalized;
    },
    store,
  });
  assert.equal(submits, 0, "a reload must never resubmit a pending action");
  assert.equal(watchHash, HASH, "it re-watches the stored hash");
  assert.equal(result.resumed, true);
  pass("reload resumes the stored hash without resubmitting");
}

async function testAmbiguousSubmitDoesNotLoop() {
  // The submit itself fails before any hash is known: raise AmbiguousSubmissionError,
  // do not store a pending hash, and do not retry inside submitOnce.
  let submits = 0;
  let watches = 0;
  const store = makeStore();
  await assert.rejects(
    () =>
      submitOnce({
        key: "wallet:curate",
        functionName: "curate_deliverable",
        submit: async () => {
          submits += 1;
          throw new Error("connection dropped before hash");
        },
        watch: async () => {
          watches += 1;
          return finalized;
        },
        store,
      }),
    (error: unknown) => error instanceof AmbiguousSubmissionError,
  );
  assert.equal(submits, 1, "exactly one submit attempt, no blind retry inside the layer");
  assert.equal(watches, 0, "there is no hash to watch");
  assert.equal(store.list().length, 0, "no phantom pending slot");
  pass("ambiguous submit raises and does not loop resubmitting");
}

async function main() {
  await testHappyPath();
  await testClientErrorAfterWriteNeverResubmits();
  await testReloadResumesStoredHash();
  await testAmbiguousSubmitDoesNotLoop();
  console.log(`retry race guard: ${checks} checks passed`);
}

main().catch((error: unknown) => {
  console.error("retry race guard FAILED:", error);
  throw error;
});
