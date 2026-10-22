import { useCallback, useEffect, useRef, useState } from "react";
import {
  AmbiguousSubmissionError,
  describeError,
  fetchBandPreview,
  fetchConfig,
  fetchDashboard,
  fetchMyBalance,
  resumePending,
  submitWrite,
  type ContractConfig,
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

type ActionResult = Awaited<ReturnType<typeof submitWrite>>;

export function usePulse() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const inFlight = useRef(false);
  const resuming = useRef(false);

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
    // get_config is fetched once for the recovery window mirrors, it does not change.
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
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

  const resume = useCallback(
    async (session: WalletSession) => {
      if (resuming.current) return;
      resuming.current = true;
      try {
        await resumePending(session.client, session.address, {
          onLine: (line, hash) =>
            pushLog({ kind: "chain", title: "Resuming pending transaction", detail: line, hash }),
          onResolved: (record, outcome) => {
            const kind: LogKind = outcome.execution === "SUCCESS" ? "success" : "error";
            pushLog({
              kind,
              title: `${record.functionName} recovered after reload`,
              detail:
                outcome.execution === "SUCCESS"
                  ? "Consensus accepted the state transition."
                  : outcome.error ?? outcome.execution,
              hash: record.hash,
            });
            void refresh();
            void refreshBalance(session);
          },
        });
      } finally {
        resuming.current = false;
      }
    },
    [pushLog, refresh, refreshBalance],
  );

  const attachWallet = useCallback(
    async (session: WalletSession) => {
      setWallet(session);
      pushLog({
        kind: "info",
        title: session.kind === "burner" ? "Burner wallet ready" : "MetaMask connected",
        detail: session.address,
      });
      await refreshBalance(session);
      void resume(session);
      sound.success();
    },
    [pushLog, refreshBalance, resume],
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
    async (label: string, fn: (session: WalletSession) => Promise<ActionResult>) => {
      if (!wallet) {
        setError("Connect a wallet first.");
        return null;
      }
      setBusy(label);
      try {
        const result = await fn(wallet);
        if (result.error || result.status === "PENDING") {
          if (result.status === "PENDING") {
            pushLog({
              kind: "chain",
              title: `${label} still pending`,
              detail: "Watch capped at 60 minutes, the hash is kept so a reload resumes it.",
              hash: result.hash,
            });
          } else {
            pushLog({
              kind: "error",
              title: `${label} reverted`,
              detail: humanError(result.error ?? result.execution),
              hash: result.hash,
            });
            sound.error();
          }
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
        if (cause instanceof AmbiguousSubmissionError) {
          // The submit call errored before a hash was known. Do NOT resubmit. Re-read
          // chain state so the user sees whether the action actually landed.
          pushLog({
            kind: "error",
            title: `${label} not confirmed, not resubmitting`,
            detail: "Refreshed on chain state instead of retrying, check the campaign below.",
          });
          await refresh();
          await refreshBalance(wallet);
          setError("Submission did not return a hash. The board was re-read from the chain; do not click again until you see the new state.");
        } else {
          const message = humanError(cause);
          pushLog({ kind: "error", title: `${label} failed`, detail: message });
          setError(message);
        }
        sound.error();
        return null;
      } finally {
        setBusy(null);
      }
    },
    [wallet, pushLog, refresh, refreshBalance],
  );

  const emitLine = useCallback(
    (label: string) => (line: string, hash?: string) =>
      pushLog({ kind: "chain", title: label, detail: line, hash }),
    [pushLog],
  );

  const faucet = useCallback(
    (amountCpt = 2000) =>
      run("Faucet claim", (session) =>
        submitWrite(session.client, "faucet_or_deposit", [BigInt(amountCpt) * BigInt(CPT)], {
          address: session.address,
          onLine: emitLine("Faucet claim"),
        }),
      ),
    [run, emitLine],
  );

  const curate = useCallback(
    (campaignId: number, stakeCpt: number) =>
      run("Curation stake", (session) =>
        submitWrite(session.client, "curate_deliverable", [
          campaignId,
          BigInt(Math.round(stakeCpt)) * BigInt(CPT),
        ], {
          address: session.address,
          campaignId,
          onLine: emitLine("Curation stake"),
        }),
      ),
    [run, emitLine],
  );

  const claim = useCallback(
    (campaignId: number) =>
      run("Settlement claim", (session) =>
        submitWrite(session.client, "claim_campaign_settlement", [campaignId], {
          address: session.address,
          campaignId,
          onLine: emitLine("Settlement claim"),
        }),
      ),
    [run, emitLine],
  );

  const refundCuration = useCallback(
    (campaignId: number) =>
      run("Curation refund", (session) =>
        submitWrite(session.client, "claim_curation_refund", [campaignId], {
          address: session.address,
          campaignId,
          onLine: emitLine("Curation refund"),
        }),
      ),
    [run, emitLine],
  );

  const withdrawLiquidity = useCallback(
    (campaignId: number) =>
      run("Withdraw liquidity", (session) =>
        submitWrite(session.client, "withdraw_campaign_liquidity", [campaignId], {
          address: session.address,
          campaignId,
          onLine: emitLine("Withdraw liquidity"),
        }),
      ),
    [run, emitLine],
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
      run("Create campaign", (session) =>
        submitWrite(
          session.client,
          "create_campaign",
          [
            input.title,
            input.tag,
            input.spec,
            BigInt(Math.round(input.baseCpt)) * BigInt(CPT),
            BigInt(Math.round(input.viralCpt)) * BigInt(CPT),
            BigInt(Math.round(input.bondCpt)) * BigInt(CPT),
            input.deadlineUnix,
          ],
          { address: session.address, onLine: emitLine("Create campaign") },
        ),
      ),
    [run, emitLine],
  );

  const verify = useCallback(
    (campaignId: number) =>
      run("Verify deliverable", (session) =>
        submitWrite(session.client, "verify_campaign_deliverable_live", [campaignId], {
          address: session.address,
          campaignId,
          onLine: emitLine("Verify deliverable"),
        }),
      ),
    [run, emitLine],
  );

  const recoverUnreachable = useCallback(
    (campaignId: number) =>
      run("Recover unreachable evidence", (session) =>
        submitWrite(session.client, "recover_unreachable_deliverable", [campaignId], {
          address: session.address,
          campaignId,
          onLine: emitLine("Recover unreachable evidence"),
        }),
      ),
    [run, emitLine],
  );

  const recoverHardTimeout = useCallback(
    (campaignId: number) =>
      run("Recover hard timeout", (session) =>
        submitWrite(session.client, "recover_hard_timeout", [campaignId], {
          address: session.address,
          campaignId,
          onLine: emitLine("Recover hard timeout"),
        }),
      ),
    [run, emitLine],
  );

  const transfer = useCallback(
    (to: string, amountCpt: number) =>
      run("Transfer CPT", (session) =>
        submitWrite(session.client, "transfer_tokens", [to, BigInt(Math.round(amountCpt)) * BigInt(CPT)], {
          address: session.address,
          onLine: emitLine("Transfer CPT"),
        }),
      ),
    [run, emitLine],
  );

  const createProbeCampaign = useCallback(
    () =>
      run("Probe campaign creation", (session) => {
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        return submitWrite(
          session.client,
          "create_campaign",
          [
            "Pulse probe campaign",
            "#PulseProbe",
            "Publish one short vertical video that shows the product, keeps the sponsor tag on screen, and reports organic reach in the description.",
            BigInt(800) * BigInt(CPT),
            BigInt(200) * BigInt(CPT),
            BigInt(50) * BigInt(CPT),
            deadline,
          ],
          { address: session.address, onLine: emitLine("Probe campaign creation") },
        );
      }),
    [run, emitLine],
  );

  const submitDeliverable = useCallback(
    (campaignId: number, proofUrl: string) =>
      run("Deliverable submission", (session) =>
        submitWrite(session.client, "accept_and_submit_deliverable", [campaignId, proofUrl], {
          address: session.address,
          campaignId,
          onLine: emitLine("Deliverable submission"),
        }),
      ),
    [run, emitLine],
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
    config,
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
