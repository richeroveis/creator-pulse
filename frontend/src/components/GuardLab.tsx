import { useState } from "react";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  FlaskConical,
  Gavel,
  Loader2,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { cpt, fmtCptValue } from "../lib/format";
import { sound } from "../lib/sound";

type Outcome = {
  state: "idle" | "running" | "pass" | "fail";
  observed: string;
  hash?: string;
};

const IDLE: Outcome = { state: "idle", observed: "" };

function ProbeCard({
  icon,
  title,
  method,
  expected,
  outcome,
  actionLabel,
  disabled,
  onRun,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  method: string;
  expected: string;
  outcome: Outcome;
  actionLabel: string;
  disabled: boolean;
  onRun: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-pulse-magenta">
            {icon}
          </span>
          <div>
            <h3 className="font-display text-[15px] font-semibold text-white">{title}</h3>
            <p className="mt-0.5 font-mono text-[10.5px] text-white/35">{method}</p>
          </div>
        </div>
        {outcome.state === "pass" && <CheckCircle2 size={18} className="text-pulse-emerald" />}
        {outcome.state === "fail" && <XCircle size={18} className="text-pulse-magenta" />}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-white/45">{expected}</p>
      {children}

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || outcome.state === "running"}
          className="btn-ghost w-full text-[12.5px]"
        >
          {outcome.state === "running" ? <Loader2 size={14} className="animate-spin" /> : <Beaker size={14} />}
          {outcome.state === "running" ? "Running probe" : actionLabel}
        </button>

        {outcome.observed && (
          <p
            className={`mt-2.5 rounded-lg border px-3 py-2 font-mono text-[10.5px] leading-relaxed ${
              outcome.state === "pass"
                ? "border-pulse-emerald/30 bg-pulse-emerald/[0.07] text-pulse-emerald/90"
                : outcome.state === "fail"
                  ? "border-pulse-magenta/30 bg-pulse-magenta/[0.07] text-pulse-magenta/90"
                  : "border-white/10 bg-black/20 text-white/50"
            }`}
          >
            {outcome.observed}
          </p>
        )}
      </div>
    </div>
  );
}

export function GuardLab({ api }: { api: PulseApi }) {
  const [clawback, setClawback] = useState<Outcome>(IDLE);
  const [curation, setCuration] = useState<Outcome>(IDLE);
  const [disclosure, setDisclosure] = useState<Outcome>(IDLE);

  const { wallet, dashboard, busy, withdrawLiquidity, curate, createProbeCampaign, faucet, previewBand } = api;
  const campaigns = dashboard?.campaigns ?? [];

  const owned = campaigns.find(
    (campaign) =>
      wallet &&
      campaign.brand.toLowerCase() === wallet.address.toLowerCase() &&
      (campaign.state === "OPEN" || campaign.state === "SUBMITTED"),
  );
  const settled = campaigns.find((campaign) => campaign.settled);
  const slashEvidence = campaigns.find(
    (campaign) => campaign.campaign_band === "BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH",
  );

  const runClawback = async () => {
    if (!wallet) {
      setClawback({ state: "fail", observed: "connect a wallet first" });
      return;
    }
    if (!owned) {
      await faucet(2000);
      const created = await createProbeCampaign();
      setClawback({
        state: created && !created.error ? "idle" : "fail",
        observed: created
          ? "probe campaign funded, run the probe again to hit the brand lock"
          : "probe campaign creation failed, claim the faucet first",
        hash: created?.hash,
      });
      return;
    }
    setClawback({ state: "running", observed: "" });
    const result = await withdrawLiquidity(owned.campaign_id);
    if (!result) {
      setClawback({ state: "fail", observed: "no receipt returned" });
      return;
    }
    const message = result.error ?? "";
    const blocked = result.execution !== "SUCCESS" && message.includes("PAPITO_LIABILITY_LOCK");
    setClawback({
      state: blocked ? "pass" : "fail",
      observed: blocked
        ? `reverted: ${message}`
        : `unexpected: ${message || result.execution}`,
      hash: result.hash,
    });
    if (blocked) sound.success();
    else sound.error();
  };

  const runCuration = async () => {
    if (!wallet) {
      setCuration({ state: "fail", observed: "connect a wallet first" });
      return;
    }
    if (!settled) {
      setCuration({ state: "fail", observed: "no settled campaign on chain yet" });
      return;
    }
    setCuration({ state: "running", observed: "" });
    const result = await curate(settled.campaign_id, 5);
    if (!result) {
      setCuration({ state: "fail", observed: "no receipt returned" });
      return;
    }
    const message = result.error ?? "";
    const blocked = result.execution !== "SUCCESS" && /settled/i.test(message);
    setCuration({
      state: blocked ? "pass" : "fail",
      observed: blocked ? `reverted: ${message}` : `unexpected: ${message || result.execution}`,
      hash: result.hash,
    });
    if (blocked) sound.success();
    else sound.error();
  };

  const runDisclosure = async () => {
    setDisclosure({ state: "running", observed: "" });
    const sample = campaigns[0];
    const base = sample?.base_reward_atto ?? 1200 * 10 ** 18;
    const viral = sample?.viral_bonus_pool_atto ?? 800 * 10 ** 18;
    const bond = sample?.required_creator_bond_atto ?? 120 * 10 ** 18;
    const result = await previewBand(
      Math.round(base / 10 ** 18),
      Math.round(viral / 10 ** 18),
      Math.round(bond / 10 ** 18),
      100,
      false,
    );
    if (!result) {
      setDisclosure({ state: "fail", observed: "preview call failed" });
      return;
    }
    const slashed =
      result.campaign_band === "BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH" &&
      Number(result.creator_payout) === 0;
    setDisclosure({
      state: slashed ? "pass" : "fail",
      observed: slashed
        ? `forced slash: creator 0 CPT, brand refund ${fmtCptValue(cpt(Number(result.brand_refund)))} CPT`
        : `unexpected band ${result.campaign_band}`,
    });
    if (slashed) sound.success();
    else sound.error();
  };

  return (
    <section id="guardlab" className="mx-auto max-w-7xl px-5 py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Security guard lab</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
            One click probes against the live contract
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
            Each probe sends a real transaction from the connected wallet, or reads the deployed
            invariant helper when the answer is deterministic. A probe passes only when the contract
            blocks the action for the documented reason.
          </p>
        </div>
        <div className="chip border-pulse-amber/30 text-pulse-amber">
          <ShieldAlert size={12} /> adversarial by default
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProbeCard
          icon={<Gavel size={17} />}
          title="Brand premature clawback"
          method="withdraw_campaign_liquidity(campaign_id)"
          expected="The funding brand tries to pull the base reward or the viral pool while the campaign is still accepting submissions, awaiting audit, or inside the post-audit dispute window."
          outcome={clawback}
          actionLabel={
            !wallet
              ? "Connect a wallet"
              : owned
                ? `Probe campaign #${owned.campaign_id}`
                : "Fund a probe campaign"
          }
          disabled={busy !== null}
          onRun={runClawback}
        >
          {owned ? (
            <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[11px] text-white/40">
              target #{owned.campaign_id} state {owned.state.toLowerCase()}, locked{" "}
              {fmtCptValue(cpt(owned.vault_locked_atto))} CPT
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[11px] text-white/40">
              no campaign funded by this wallet. The button claims CPT and funds a 1,000 CPT probe
              campaign so the guard can be triggered honestly.
            </p>
          )}
        </ProbeCard>

        <ProbeCard
          icon={<FlaskConical size={17} />}
          title="Post-settlement curation"
          method="curate_deliverable(campaign_id, stake)"
          expected="After settlement the campaign must leave the curated ranking forever, so any late curation stake is rejected before funds move."
          outcome={curation}
          actionLabel={settled ? `Probe settled campaign #${settled.campaign_id}` : "No settled campaign yet"}
          disabled={busy !== null || !settled}
          onRun={runCuration}
        >
          <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[11px] text-white/40">
            {settled
              ? `target #${settled.campaign_id}, band ${settled.campaign_band}`
              : "wait for the first claim_campaign_settlement to finalize"}
          </p>
        </ProbeCard>

        <ProbeCard
          icon={<AlertTriangle size={17} />}
          title="Missing disclosure tag"
          method="get_campaign_band_preview(..., disclosure=false)"
          expected="A deliverable without the authenticated brand tag can never be paid. The helper forces the slash band and returns zero CPT to the creator."
          outcome={disclosure}
          actionLabel="Probe the invariant helper"
          disabled={busy !== null}
          onRun={runDisclosure}
        >
          <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[11px] text-white/40">
            {slashEvidence
              ? `on-chain precedent: campaign #${slashEvidence.campaign_id} was audited and slashed`
              : "deterministic read, no transaction required"}
          </p>
        </ProbeCard>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/30">
        <span className="inline-flex items-center gap-1.5">
          <Zap size={12} className="text-pulse-amber" /> Probes never bypass consensus.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Beaker size={12} className="text-pulse-violet" /> Reverted probes still finalize on chain with
          FINISHED_WITH_ERROR.
        </span>
      </div>
    </section>
  );
}
