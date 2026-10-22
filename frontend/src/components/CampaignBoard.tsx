import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Clock4,
  ExternalLink,
  Gavel,
  Layers,
  RefreshCcw,
  ScanEye,
  ShieldCheck,
  LifeBuoy,
  UploadCloud,
  Users,
} from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { explorerTx } from "../config";
import {
  BAND_LABEL,
  BAND_TONE,
  STATE_TONE,
  cpt,
  fmtCpt,
  relativeClock,
  shortAddr,
  txShort,
  type Campaign,
} from "../lib/format";
import { validateProofUrl } from "../lib/validation";
import { sound } from "../lib/sound";

// Mirror of the contract recovery windows, shown only to explain the buttons.
const RECOVER_UNREACHABLE_MIN_SECONDS = 60 * 60;
const RECOVER_TIMEOUT_MIN_SECONDS = 60 * 60 * 24 * 7;

type Feedback = { kind: "idle" | "ok" | "err"; text: string; hash?: string };

function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/35">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  api,
  onInspect,
}: {
  campaign: Campaign;
  api: PulseApi;
  onInspect: (id: number) => void;
}) {
  const {
    wallet,
    balance,
    busy,
    curate,
    claim,
    refundCuration,
    submitDeliverable,
    verify,
    recoverUnreachable,
    recoverHardTimeout,
    withdrawLiquidity,
  } = api;
  const [stake, setStake] = useState(25);
  const defaultProof = `https://richeroveis.github.io/creator-pulse/proofs/campaign-${Math.min(campaign.campaign_id, 3)}.html`;
  const [proofUrl, setProofUrl] = useState(defaultProof);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", text: "" });
  const now = useNowSeconds();
  const runAction = async (label: string, fn: () => Promise<{ execution: string; hash?: string; error?: string } | null>) => {
    if (busy !== null) return;
    setFeedback({ kind: "idle", text: `${label} submitted, waiting for FINALIZED` });
    const result = await fn();
    if (!result) {
      setFeedback({ kind: "err", text: `${label} failed, connect a wallet or retry` });
      return;
    }
    if (result.error || result.execution !== "SUCCESS") {
      setFeedback({ kind: "err", text: result.error ?? result.execution, hash: result.hash });
    } else {
      setFeedback({ kind: "ok", text: `${label} finalized`, hash: result.hash });
    }
  };
  const isMine =
    wallet &&
    (campaign.brand.toLowerCase() === wallet.address.toLowerCase() ||
      campaign.creator.toLowerCase() === wallet.address.toLowerCase());
  const needsBond = balance !== null && cpt(balance) < cpt(campaign.required_creator_bond_atto);

  return (
    <article className="panel group relative overflow-hidden p-5 transition hover:border-white/[0.14]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pulse-violet/40 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip font-mono text-[10px] text-white/50">#{campaign.campaign_id}</span>
            <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${STATE_TONE[campaign.state] ?? "text-white/40"}`}>
              {campaign.state.toLowerCase()}
            </span>
            {campaign.campaign_band && (
              <span className={`chip border ${BAND_TONE[campaign.campaign_band] ?? ""}`}>
                {BAND_LABEL[campaign.campaign_band] ?? campaign.campaign_band}
              </span>
            )}
            {isMine && <span className="chip border-pulse-ice/30 text-pulse-ice">your role</span>}
          </div>
          <h3 className="mt-2.5 truncate font-display text-lg font-semibold tracking-tight text-white">
            {campaign.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/40">
            <span className="text-pulse-magenta">{campaign.brand_tag_token}</span>
            <span>brand {shortAddr(campaign.brand)}</span>
            <span>
              creator{" "}
              {campaign.creator === "0x0000000000000000000000000000000000000000"
                ? "open slot"
                : shortAddr(campaign.creator)}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onInspect(campaign.campaign_id);
            sound.click();
          }}
          className="rounded-lg border border-white/10 p-2 text-white/50 transition hover:border-white/30 hover:text-white"
          title="Open consensus inspector"
        >
          <ScanEye size={15} />
        </button>
      </div>

      <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-white/45">
        {campaign.required_deliverable_spec}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Base", campaign.base_reward_atto, "text-white"],
          ["Viral pool", campaign.viral_bonus_pool_atto, "text-pulse-violet"],
          ["Bond", campaign.required_creator_bond_atto, "text-pulse-amber"],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="panel-tight px-2.5 py-2">
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/35">{label}</p>
            <p className={`font-mono text-[12.5px] ${tone as string}`}>{fmtCpt(value as number)}</p>
          </div>
        ))}
      </div>

      {campaign.evaluated ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="panel-tight px-2.5 py-2">
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/35">Creator payout</p>
            <p className="font-mono text-[12.5px] text-pulse-emerald">{fmtCpt(campaign.creator_payout_atto)}</p>
          </div>
          <div className="panel-tight px-2.5 py-2">
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/35">Brand refund</p>
            <p className="font-mono text-[12.5px] text-pulse-ice">{fmtCpt(campaign.brand_refund_atto)}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-pulse-emerald" /> {fmtCpt(campaign.max_liability_atto)} CPT max liability
          </span>
          <span className="font-mono">{fmtCpt(campaign.vault_locked_atto)} locked</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Meter label="Viral velocity" value={campaign.viral_velocity} tone="bg-gradient-to-r from-pulse-violet to-pulse-magenta" />
        <Meter label="Organic" value={campaign.organic_authenticity} tone="bg-gradient-to-r from-pulse-emerald to-pulse-ice" />
      </div>

      <div className="mt-3 flex items-center justify-between text-[10.5px] text-white/30">
        <span className="inline-flex items-center gap-1.5">
          <Clock4 size={11} /> deadline {relativeClock(campaign.submission_deadline_clock)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={11} /> {fmtCpt(campaign.curation_stake_total_atto)} CPT curated
        </span>
        <a
          href={campaign.content_proof_url || "#"}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1 ${campaign.content_proof_url ? "hover:text-white/70" : "pointer-events-none opacity-40"}`}
        >
          proof <ExternalLink size={11} />
        </a>
      </div>

      {(() => {
        const urlError = validateProofUrl(proofUrl);
        const isBrand = !!wallet && campaign.brand.toLowerCase() === wallet.address.toLowerCase();
        const disputeClosed = campaign.settlement_unlock_clock !== 0 && now >= campaign.settlement_unlock_clock;
        const canClaim = campaign.evaluated && !campaign.settled && disputeClosed;
        const canRefund = campaign.settled || campaign.state === "RECOVERED";
        const elapsed = campaign.submitted_clock ? now - campaign.submitted_clock : 0;
        const unreachableReady = campaign.state === "SUBMITTED" && elapsed >= RECOVER_UNREACHABLE_MIN_SECONDS;
        const timeoutReady = campaign.state === "SUBMITTED" && elapsed >= RECOVER_TIMEOUT_MIN_SECONDS;
        const curatable =
          (campaign.state === "SUBMITTED" || campaign.state === "EVALUATED") &&
          !campaign.settled;
        return (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {campaign.state === "OPEN" && (
                <div className="flex w-full flex-col gap-2">
                  <input
                    type="url"
                    value={proofUrl}
                    onChange={(event) => setProofUrl(event.target.value)}
                    placeholder="https://public-host/proof.html"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] text-white outline-none focus:border-pulse-violet/60"
                    aria-label="Proof URL"
                  />
                  {urlError && <p className="text-[11px] text-pulse-magenta">{urlError}</p>}
                  <button
                    type="button"
                    disabled={busy !== null || !!urlError || !wallet}
                    onClick={() =>
                      runAction("Submit deliverable", () => submitDeliverable(campaign.campaign_id, proofUrl.trim()))
                    }
                    className="btn-primary px-3 py-2 text-[12px] disabled:opacity-40"
                    title={needsBond ? "Claim CPT from the faucet first to cover the bond" : "Lock the bond and submit"}
                  >
                    <UploadCloud size={14} /> Accept and submit deliverable
                  </button>
                </div>
              )}
              {campaign.state === "SUBMITTED" && !campaign.evaluated && (
                <button
                  type="button"
                  disabled={busy !== null || !wallet}
                  onClick={() => runAction("Verify", () => verify(campaign.campaign_id))}
                  className="btn-primary px-3 py-2 text-[12px] disabled:opacity-40"
                  title="Validators fetch the proof URL and must agree on the band"
                >
                  <ScanEye size={14} /> Verify deliverable
                </button>
              )}
              {curatable && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={stake}
                    onChange={(event) => setStake(Number(event.target.value))}
                    className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-center font-mono text-[12px] text-white outline-none focus:border-pulse-violet/60"
                    aria-label="Curation stake in CPT"
                  />
                  <button
                    type="button"
                    disabled={busy !== null || !wallet}
                    onClick={() => runAction("Curate", () => curate(campaign.campaign_id, stake))}
                    className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-40"
                  >
                    <Layers size={14} /> Curate
                  </button>
                </div>
              )}
              {campaign.state === "EVALUATED" && !campaign.settled && (
                <button
                  type="button"
                  disabled={busy !== null || !canClaim || !wallet}
                  onClick={() => runAction("Claim settlement", () => claim(campaign.campaign_id))}
                  className="btn-emerald px-3 py-2 text-[12px] disabled:opacity-40"
                  title={canClaim ? "Dispute window closed" : "Settlement unlocks after the consensus audit and the dispute window"}
                >
                  <Gavel size={14} /> Claim settlement
                </button>
              )}
              {canRefund && (
                <button
                  type="button"
                  disabled={busy !== null || !wallet}
                  onClick={() => runAction("Curation refund", () => refundCuration(campaign.campaign_id))}
                  className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-40"
                >
                  <CircleDollarSign size={14} /> Claim curation refund
                </button>
              )}
              {campaign.state === "SUBMITTED" && (
                <>
                  <button
                    type="button"
                    disabled={busy !== null || !unreachableReady || !wallet}
                    onClick={() => runAction("Recover unreachable", () => recoverUnreachable(campaign.campaign_id))}
                    className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-40"
                    title={unreachableReady ? "Neutral recovery if validators agree the page is dead" : "Unreachable recovery opens 1 hour after submission"}
                  >
                    <LifeBuoy size={14} /> Recover unreachable
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || !timeoutReady || !wallet}
                    onClick={() => runAction("Recover hard timeout", () => recoverHardTimeout(campaign.campaign_id))}
                    className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-40"
                    title={timeoutReady ? "Neutral recovery after the 7 day hard timeout" : "Hard timeout recovery opens 7 days after submission"}
                  >
                    <RefreshCcw size={14} /> Recover hard timeout
                  </button>
                </>
              )}
              {isBrand && campaign.state === "OPEN" && (
                <button
                  type="button"
                  disabled={busy !== null || now < campaign.submission_deadline_clock}
                  onClick={() => runAction("Withdraw liquidity", () => withdrawLiquidity(campaign.campaign_id))}
                  className="btn-ghost px-3 py-2 text-[12px] disabled:opacity-40"
                  title={now < campaign.submission_deadline_clock ? "Only after the submission deadline" : "Reclaim the unfunded vault"}
                >
                  <CircleDollarSign size={14} /> Withdraw liquidity
                </button>
              )}
              <a
                href={`https://explorer-studio.genlayer.com/address/${campaign.brand}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/35 transition hover:text-white/70"
              >
                brand on explorer <ArrowUpRight size={11} />
              </a>
            </div>

            {campaign.state === "SUBMITTED" && !campaign.evaluated && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-pulse-amber/80">
                <ShieldCheck size={12} /> No settlement is possible until the consensus audit has run on this proof.
              </p>
            )}
            {campaign.state === "EVALUATED" && !disputeClosed && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
                <Clock4 size={12} /> dispute window closes {relativeClock(campaign.settlement_unlock_clock)}
              </p>
            )}

            {needsBond && campaign.state === "OPEN" && (
              <p className="mt-2 text-[11px] text-pulse-amber/80">
                This account needs at least {fmtCpt(campaign.required_creator_bond_atto)} CPT for the bond. Use
                the wallet menu to claim the faucet.
              </p>
            )}

            {feedback.kind !== "idle" && (
              <div
                className={`mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 font-mono text-[10.5px] ${
                  feedback.kind === "ok"
                    ? "border-pulse-emerald/30 bg-pulse-emerald/[0.07] text-pulse-emerald/90"
                    : "border-pulse-magenta/30 bg-pulse-magenta/[0.07] text-pulse-magenta/90"
                }`}
              >
                <span className="break-words">{feedback.text}</span>
                {feedback.hash && (
                  <a href={explorerTx(feedback.hash)} target="_blank" rel="noreferrer" className="shrink-0 underline">
                    {txShort(feedback.hash)}
                  </a>
                )}
              </div>
            )}
          </>
        );
      })()}

      {campaign.audit_evidence && (
        <p className="mt-3 border-l-2 border-pulse-violet/40 pl-2.5 text-[11px] italic leading-relaxed text-white/40">
          auditor: {campaign.audit_evidence}
        </p>
      )}
    </article>
  );
}

export function CampaignBoard({ api, onInspect }: { api: PulseApi; onInspect: (id: number) => void }) {
  const campaigns = api.dashboard?.campaigns ?? [];
  const [filter, setFilter] = useState<"all" | "live" | "settled">("all");
  const visible = campaigns.filter((campaign) => {
    if (filter === "live") return !campaign.settled && campaign.state !== "CANCELLED";
    if (filter === "settled") return campaign.settled;
    return true;
  });

  return (
    <section id="campaigns" className="mx-auto max-w-7xl px-5 py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Funded campaign vault</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
            Campaigns on studionet
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Every reward is already inside the vault. The brand tag, the deadline and the maximum
            liability are fixed at funding time and cannot be edited afterwards.
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "live", "settled"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setFilter(option);
                sound.click();
              }}
              className={`chip capitalize transition ${filter === option ? "border-pulse-violet/60 text-white" : "hover:text-white/80"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-lg text-white/70">No campaigns in this view yet.</p>
          <p className="mt-2 max-w-md text-sm text-white/40">
            The board fills up as soon as the seeding script finalizes the first funded campaigns on
            studionet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((campaign) => (
            <CampaignCard key={campaign.campaign_id} campaign={campaign} api={api} onInspect={onInspect} />
          ))}
        </div>
      )}
    </section>
  );
}
