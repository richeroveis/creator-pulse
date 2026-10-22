import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { CalldataEncodable, TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS, isDeployed } from "../config";
import type { Dashboard } from "./format";
import {
  submitOnce,
  type PendingRecord,
  type PendingStore,
  type ReceiptOutcome,
} from "./submitOnce";

export { AmbiguousSubmissionError } from "./submitOnce";
export type { PendingRecord, ReceiptOutcome };

type AnyClient = ReturnType<typeof createClient>;

const readClient = createClient({ chain: studionet });

export const readOnlyClient = readClient;

export async function readFunction<T = CalldataEncodable>(
  functionName: string,
  args: CalldataEncodable[] = [],
  client: AnyClient = readClient,
): Promise<T> {
  if (!isDeployed) {
    throw new Error("The studionet contract address is not published yet.");
  }
  // No local abi override: genlayer-js resolves the deployed schema itself.
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args,
  })) as T;
}

export async function fetchDashboard(limit = 12): Promise<Dashboard> {
  return readFunction<Dashboard>("get_dashboard", [limit]);
}

export async function fetchMyBalance(address: string, client?: AnyClient): Promise<number> {
  const value = await readFunction<number>("get_token_balance", [address], client);
  return Number(value);
}

export interface ContractConfig {
  atto_per_cpt: number;
  dispute_window_seconds: number;
  recover_unreachable_min_seconds: number;
  recover_unreachable_max_seconds: number;
  recover_timeout_min_seconds: number;
  recover_timeout_max_seconds: number;
}

/**
 * The recovery windows only live in get_config, not in get_dashboard, so the board
 * reads them here and gates the recovery buttons from the real contract floor instead
 * of a hardcoded guess that can drift from the deployed code.
 */
export async function fetchConfig(client: AnyClient = readClient): Promise<ContractConfig> {
  return readFunction<ContractConfig>("get_config", [], client);
}

export async function fetchBandPreview(
  base: number,
  viral: number,
  bond: number,
  anchor: number,
  disclosure: boolean,
): Promise<{
  campaign_band: string;
  quality_anchor: number;
  creator_payout: number;
  brand_refund: number;
  bonus_released: boolean;
}> {
  return readFunction("get_campaign_band_preview", [base, viral, bond, anchor, disclosure]);
}

export interface WriteResult extends ReceiptOutcome {
  hash: string;
}

// ------------------------------------------------------------ pending store

const PENDING_KEY = "creatorpulse.pending.v1";

function readAll(): Record<string, PendingRecord> {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PendingRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PendingRecord>): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(map));
  } catch {
    // Private browsing or quota: the guard still works for this tab, only the
    // reload resume is lost. No key material is ever stored, so nothing leaks.
  }
}

export const pendingStore: PendingStore = {
  get(key) {
    return readAll()[key] ?? null;
  },
  set(key, record) {
    const map = readAll();
    map[key] = record;
    writeAll(map);
  },
  clear(key) {
    const map = readAll();
    delete map[key];
    writeAll(map);
  },
  list() {
    const map = readAll();
    return Object.keys(map).map((key) => ({ key, record: map[key] }));
  },
};

/**
 * A stable fingerprint used only as a localStorage slot name. It carries the public
 * sender address, not any secret. Two clicks of the same action by the same wallet
 * collapse onto the same key, which is what makes the second click resume instead of
 * resubmit.
 */
export function submissionKey(functionName: string, args: CalldataEncodable[], address: string): string {
  const flat = args
    .map((arg) => (typeof arg === "bigint" || typeof arg === "number" ? String(arg) : JSON.stringify(arg)))
    .join("|");
  return `${address.toLowerCase()}:${functionName}:${flat}`;
}

// ------------------------------------------------------------ receipt watch

const WATCH_DEADLINE_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseReceipt(hash: string, receipt: Record<string, unknown>): WriteResult {
  const status = String(receipt.status_name ?? receipt.status ?? "UNKNOWN");
  const consensus = receipt.consensus_data as
    | { leader_receipt?: Array<Record<string, unknown>> }
    | undefined;
  const leader = consensus?.leader_receipt?.[0] ?? {};
  const vmResult = leader.result as { status?: string; payload?: string } | undefined;
  const rollback = vmResult?.status === "rollback";
  const execution = rollback
    ? "FINISHED_WITH_ERROR"
    : String(leader.execution_result ?? receipt.tx_execution_result_name ?? "SUCCESS");
  const genvm = leader.genvm_result as Record<string, unknown> | undefined;
  const stderr = String(genvm?.stderr ?? "").trim();
  const payload = typeof vmResult?.payload === "string" ? vmResult.payload : "";
  const result: WriteResult = { hash, status, execution };
  if (execution !== "SUCCESS") {
    result.error = payload || stderr || `Execution finished with ${execution}`;
  } else if (payload) {
    try {
      result.returned = JSON.parse(payload);
    } catch {
      result.returned = payload;
    }
  }
  return result;
}

/**
 * Poll one already submitted hash until FINALIZED, up to 60 minutes, with backoff.
 * It only ever looks at the hash it was handed. A transient RPC or polling error is
 * caught and retried against the SAME hash, which is precisely the behavior that stops
 * a slow audit from turning into a duplicate submission.
 */
export async function watchReceipt(
  client: AnyClient,
  hash: string,
  onLine: (line: string) => void,
): Promise<ReceiptOutcome> {
  const start = Date.now();
  const deadline = start + WATCH_DEADLINE_MS;
  let delay = 8000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      // One status lookup per cycle, then a real sleep. This keeps a slow audit well
      // inside the 60 minute budget while spending as few studionet requests as
      // possible, because the network enforces a strict 500 requests per hour limit.
      const receipt = (await client.waitForTransactionReceipt({
        hash: hash as `0x${string}` & { length: 66 },
        status: "FINALIZED" as TransactionStatus,
        retries: 1,
        interval: 3000,
      })) as Record<string, unknown>;
      const parsed = parseReceipt(hash, receipt);
      if (parsed.status === "FINALIZED") {
        const elapsed = Math.round((Date.now() - start) / 1000);
        onLine(`FINALIZED after ${elapsed}s, ${parsed.execution}`);
        return parsed;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const elapsed = Math.round((Date.now() - start) / 1000);
      onLine(`waiting ${elapsed}s, poll ${attempt} still pending, keeping ${hash.slice(0, 10)} (not resubmitting): ${message.slice(0, 70)}`);
    }
    delay = Math.min(delay + 2000, 20000);
    await sleep(delay);
  }
  return { status: "PENDING", execution: "PENDING" };
}

/**
 * Submit a write at most once and resolve it. A client side error after the hash is
 * known never resubmits, it keeps the hash pending so resumePending or a page reload
 * finishes the job. A failure before any hash is known raises
 * AmbiguousSubmissionError so the caller re-reads state instead of double submitting.
 */
export async function submitWrite(
  client: AnyClient,
  functionName: string,
  args: CalldataEncodable[],
  options: {
    address: string;
    campaignId?: number | null;
    onLine?: (line: string, hash?: string) => void;
  },
): Promise<WriteResult> {
  if (!isDeployed) {
    throw new Error("The studionet contract address is not published yet.");
  }
  const key = submissionKey(functionName, args, options.address);
  const onLine = options.onLine ?? (() => {});
  const { hash, outcome } = await submitOnce({
    key,
    functionName,
    campaignId: options.campaignId ?? null,
    submit: () =>
      client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName,
        args,
        value: 0n,
      }) as Promise<string>,
    watch: (pendingHash, line) => watchReceipt(client, pendingHash, line),
    store: pendingStore,
    onLine,
  });
  return { hash, ...outcome };
}

/**
 * After a reload, re-attach to any submission this wallet left pending. Reads only the
 * stored hashes, never any key material, and reports each resolved outcome through the
 * supplied callbacks.
 */
export async function resumePending(
  client: AnyClient,
  address: string,
  handlers: {
    onLine: (line: string, hash?: string) => void;
    onResolved: (record: PendingRecord, outcome: ReceiptOutcome) => void;
  },
): Promise<void> {
  const prefix = `${address.toLowerCase()}:`;
  const mine = pendingStore.list().filter((entry) => entry.key.startsWith(prefix));
  for (const entry of mine) {
    const outcome = await watchReceipt(client, entry.record.hash, (line) =>
      handlers.onLine(line, entry.record.hash),
    );
    if (outcome.status !== "PENDING") {
      pendingStore.clear(entry.key);
      handlers.onResolved(entry.record, outcome);
    } else {
      handlers.onLine(`still watching ${entry.record.hash.slice(0, 10)}`, entry.record.hash);
    }
  }
}

export function describeError(error: unknown): string {
  if (!error) return "Unknown error";
  const message = error instanceof Error ? error.message : String(error);
  const marker = message.match(/\[(?:EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\][^"'\n]*/);
  if (marker) return marker[0];
  return message.split("\n")[0].slice(0, 240);
}
