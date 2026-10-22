import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeError,
  fetchBandPreview,
  fetchDashboard,
  fetchMyBalance,
  writeFunction,
} from "../lib/genlayer";
import { CPT, type Dashboard } from "../lib/format";
import { connectMetaMask, createBurner, type WalletSession } from "../lib/wallet";
import { sound } from "../lib/sound";

export type LogKind = "info" | "success" | "error" | "chain";

export interface LogEntry {
  id: number;
  at: string;
  kind: LogKind;
  title: string;
  detail?: string;
  hash?: string;
}

let logSeq = 1;

const humanError = (value: unknown): string => {
  const text = describeError(value);
  return text
    .replace(/\[EXPECTED\]\s*/g, "")
    .replace(/\[LLM_ERROR\]\s*/g, "Auditor JSON rejected: ")
    .replace(/\[EXTERNAL\]\s*/g, "External source rejected: ")
    .replace(/\[TRANSIENT\]\s*/g, "Transient network failure: ");
};

export function usePulse() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const inFlight = useRef(false);

  const pushLog = useCallback((entry: Omit<LogEntry, "id" | "at">) => {
    setLog((current) =>
      [
        {
          id: logSeq++,
          at: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          ...entry,
        },
        ...current,
      ].slice(0, 14),
    );
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const next = await fetchDashboard(12);
      setDashboard(next);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (cause) {
      setError(humanError(cause));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshBalance = useCallback(async (session: WalletSession | null) => {
    if (!session) {
      setBalance(null);
      return;
    }
    try {
      const value = await fetchMyBalance(session.address);
      setBalance(value);
    } catch {
      setBalance(null);
    }
  }, []);

  const attachWallet = useCallback(
    async (session: WalletSession) => {
      setWallet(session);
      pushLog({
        kind: "info",
        title: session.kind === "burner" ? "Burner wallet ready" : "MetaMask connected",
        detail: session.address,
      });
      await refreshBalance(session);
      sound.success();
    },
    [pushLog, refreshBalance],
  );

  const connectBurner = useCallback(async () => {
    try {
      await attachWallet(createBurner());
    } catch (cause) {
      setError(humanError(cause));
    }
  }, [attachWallet]);

  const connectWalletConnect = useCallback(async () => {
    try {
      await attachWallet(await connectMetaMask());
    } catch (cause) {
      setError(humanError(cause));
    }
  }, [attachWallet]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setBalance(null);
    pushLog({ kind: "info", title: "Wallet detached" });
  }, [pushLog]);

  const run = useCallback(
    async (
      label: string,
      fn: (session: WalletSession) => Promise<{ execution: string; hash?: string; error?: string; returned?: unknown }>,
    ) => {
      if (!wallet) {
        setError("Connect a wallet first.");
        return null;
      }
      setBusy(label);
      pushLog({ kind: "chain", title: `${label} submitted` });
      try {
        const result = await fn(wallet);
        if (result.error || result.execution !== "SUCCESS") {
          pushLog({
            kind: "error",
            title: `${label} reverted`,
            detail: result.error ? humanError(result.error) : result.execution,
            hash: result.hash,
          });
          sound.error();
        } else {
          pushLog({
            kind: "success",
            title: `${label} finalized`,
            detail: "Consensus accepted the state transition.",
            hash: result.hash,
          });
          sound.success();
        }
        await refresh();
        await refreshBalance(wallet);
        return result;
      } catch (cause) {
        const message = humanError(cause);
        pushLog({ kind: "error", title: `${label} failed`, detail: message });
        setError(message);
        sound.error();
        return null;
      } finally {
        setBusy(null);
      }
    },
    [wallet, pushLog, refresh, refreshBalance],
  );

  const faucet = useCallback(
    (amountCpt = 2000) =>
      run("Faucet claim", async (session) => {
        const result = await writeFunction(session.client, "faucet_or_deposit", [
          BigInt(amountCpt) * BigInt(CPT),
        ]);
        return result;
      }),
    [run],
  );

  const curate = useCallback(
    (campaignId: number, stakeCpt: number) =>
      run("Curation stake", async (session) => {
        const result = await writeFunction(session.client, "curate_deliverable", [
          campaignId,
          BigInt(Math.round(stakeCpt)) * BigInt(CPT),
        ]);
        return result;
      }),
    [run],
  );

  const claim = useCallback(
    (campaignId: number) =>
      run("Settlement claim", async (session) => {
        const result = await writeFunction(session.client, "claim_campaign_settlement", [
          campaignId,
        ]);
        return result;
      }),
    [run],
  );

  const refundCuration = useCallback(
    (campaignId: number) =>
      run("Curation refund", async (session) => {
        const result = await writeFunction(session.client, "claim_curation_refund", [campaignId]);
        return result;
      }),
    [run],
  );

  const withdrawLiquidity = useCallback(
    (campaignId: number) =>
      run("Withdraw liquidity", async (session) => {
        const result = await writeFunction(session.client, "withdraw_campaign_liquidity", [
          campaignId,
        ]);
        return result;
      }),
    [run],
  );

  const createCampaign = useCallback(
    (input: {
      title: string;
      tag: string;
      spec: string;
      baseCpt: number;
      viralCpt: number;
      bondCpt: number;
      deadlineUnix: number;
    }) =>
      run("Create campaign", async (session) => {
        const result = await writeFunction(session.client, "create_campaign", [
          input.title,
          input.tag,
          input.spec,
          BigInt(Math.round(input.baseCpt)) * BigInt(CPT),
          BigInt(Math.round(input.viralCpt)) * BigInt(CPT),
          BigInt(Math.round(input.bondCpt)) * BigInt(CPT),
          input.deadlineUnix,
        ]);
        return result;
      }),
    [run],
  );

  const verify = useCallback(
    (campaignId: number) =>
      run("Verify deliverable", async (session) => {
        const result = await writeFunction(session.client, "verify_campaign_deliverable_live", [
          campaignId,
        ]);
        return result;
      }),
    [run],
  );

  const recoverUnreachable = useCallback(
    (campaignId: number) =>
      run("Recover unreachable evidence", async (session) => {
        const result = await writeFunction(session.client, "recover_unreachable_deliverable", [
          campaignId,
        ]);
        return result;
      }),
    [run],
  );

  const recoverHardTimeout = useCallback(
    (campaignId: number) =>
      run("Recover hard timeout", async (session) => {
        const result = await writeFunction(session.client, "recover_hard_timeout", [campaignId]);
        return result;
      }),
    [run],
  );

  const transfer = useCallback(
    (to: string, amountCpt: number) =>
      run("Transfer CPT", async (session) => {
        const result = await writeFunction(session.client, "transfer_tokens", [
          to,
          BigInt(Math.round(amountCpt)) * BigInt(CPT),
        ]);
        return result;
      }),
    [run],
  );

  const createProbeCampaign = useCallback(
    () =>
      run("Probe campaign creation", async (session) => {
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const result = await writeFunction(session.client, "create_campaign", [
          "Pulse probe campaign",
          "#PulseProbe",
          "Publish one short vertical video that shows the product, keeps the sponsor tag on screen, and reports organic reach in the description.",
          BigInt(800) * BigInt(CPT),
          BigInt(200) * BigInt(CPT),
          BigInt(50) * BigInt(CPT),
          deadline,
        ]);
        return result;
      }),
    [run],
  );

  const submitDeliverable = useCallback(
    (campaignId: number, proofUrl: string) =>
      run("Deliverable submission", async (session) => {
        const result = await writeFunction(session.client, "accept_and_submit_deliverable", [
          campaignId,
          proofUrl,
        ]);
        return result;
      }),
    [run],
  );

  const previewBand = useCallback(
    async (baseCpt: number, viralCpt: number, bondCpt: number, anchor: number, disclosure: boolean) => {
      try {
        return await fetchBandPreview(
          Math.round(baseCpt) * CPT,
          Math.round(viralCpt) * CPT,
          Math.round(bondCpt) * CPT,
          anchor,
          disclosure,
        );
      } catch (cause) {
        setError(humanError(cause));
        return null;
      }
    },
    [],
  );

  return {
    dashboard,
    loading,
    error,
    wallet,
    balance,
    busy,
    updatedAt,
    log,
    refresh,
    pushLog,
    connectBurner,
    connectWalletConnect,
    disconnect,
    faucet,
    curate,
    claim,
    refundCuration,
    withdrawLiquidity,
    createCampaign,
    createProbeCampaign,
    submitDeliverable,
    verify,
    recoverUnreachable,
    recoverHardTimeout,
    transfer,
    previewBand,
    setError,
  };
}

export type PulseApi = ReturnType<typeof usePulse>;
