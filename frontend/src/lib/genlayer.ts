import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { CalldataEncodable, TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS, isDeployed } from "../config";
import type { Dashboard } from "./format";

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

export interface WriteResult {
  hash: string;
  status: string;
  execution: string;
  error?: string;
  returned?: unknown;
}

export async function writeFunction(
  client: AnyClient,
  functionName: string,
  args: CalldataEncodable[],
  onStatus?: (line: string) => void,
): Promise<WriteResult> {
  if (!isDeployed) {
    throw new Error("The studionet contract address is not published yet.");
  }
  onStatus?.(`signing ${functionName}`);
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args,
    value: 0n,
  })) as string;
  onStatus?.(`accepted by the network, waiting for consensus ${hash.slice(0, 10)}`);
  const receipt = (await client.waitForTransactionReceipt({
    hash: hash as `0x${string}` & { length: 66 },
    status: "ACCEPTED" as TransactionStatus,
    retries: 120,
    interval: 3000,
  })) as Record<string, unknown>;
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
  }
  onStatus?.(`${status} / ${execution}`);
  return result;
}

export function describeError(error: unknown): string {
  if (!error) return "Unknown error";
  const message = error instanceof Error ? error.message : String(error);
  const marker = message.match(/\[(?:EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\][^"'\n]*/);
  if (marker) return marker[0];
  return message.split("\n")[0].slice(0, 240);
}
