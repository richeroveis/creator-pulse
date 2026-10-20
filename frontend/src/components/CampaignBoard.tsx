import { useState } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Clock4,
  ExternalLink,
  Gavel,
  Layers,
  ScanEye,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import {
  BAND_LABEL,
  BAND_TONE,
  STATE_TONE,
  cpt,
  fmtCpt,
  relativeClock,
  shortAddr,
  type Campaign,
} from "../lib/format";
import { sound } from "../lib/sound";

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
  const { wallet, balance, busy, curate, claim, refundCuration, submitDeliverable } = api;
  const [stake, setStake] = useState(25);
  const isMine =
    wallet &&
    (campaign.brand.toLowerCase() === wallet.address.toLowerCase() ||
      campaign.creator.toLowerCase() === wallet.address.toLowerCase());
  const canSubmit = campaign.state === "OPEN" && wallet !== null;
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canSubmit && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              submitDeliverable(
                campaign.campaign_id,
                `https://richeroveis.github.io/creator-pulse/proofs/campaign-${Math.min(campaign.campaign_id, 3)}.html`,
              )
            }
            className="btn-primary px-3 py-2 text-[12px]"
            title={needsBond ? "Claim CPT from the faucet first to cover the bond" : "Lock the bond and submit"}
          >
            <UploadCloud size={14} /> Submit deliverable
          </button>
        )}
        {(campaign.state === "SUBMITTED" || campaign.state === "EVALUATED") && (
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
              disabled={busy !== null}
              onClick={() => curate(campaign.campaign_id, stake)}
              className="btn-ghost px-3 py-2 text-[12px]"
            >
              <Layers size={14} /> Curate
            </button>
          </div>
        )}
        {campaign.evaluated && !campaign.settled && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => claim(campaign.campaign_id)}
            className="btn-emerald px-3 py-2 text-[12px]"
          >
            <Gavel size={14} /> Claim settlement
          </button>
        )}
        {campaign.settled && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => refundCuration(campaign.campaign_id)}
            className="btn-ghost px-3 py-2 text-[12px]"
          >
            <CircleDollarSign size={14} /> Refund my stake
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

      {needsBond && canSubmit && (
        <p className="mt-2 text-[11px] text-pulse-amber/80">
          This account needs at least {fmtCpt(campaign.required_creator_bond_atto)} CPT for the bond.
          Use the wallet menu to claim the faucet.
        </p>
      )}

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
