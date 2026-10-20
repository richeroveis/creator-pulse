import { Crown, Flame, Sparkles, TrendingUp } from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { BAND_LABEL, BAND_TONE, fmtCpt } from "../lib/format";

export function FeedRail({ api }: { api: PulseApi }) {
  const feed = api.dashboard?.feed ?? [];
  const topId = api.dashboard?.stats.top_curated_campaign_id ?? 0;
  const totalStake = feed.reduce((sum, entry) => sum + entry.curation_stake_total_atto, 0);

  return (
    <section id="feed" className="mx-auto max-w-7xl px-5 py-14">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="panel relative overflow-hidden p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pulse-magenta/60 to-transparent" />
          <p className="label">Community curation</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
            Stake CPT to lift a deliverable
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Curators lock CPT behind the deliverables they believe deserve distribution. Only
            evaluated campaigns enter the ranking, and a settled campaign drops out immediately.
            Stakes are refundable by their owner after settlement.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="panel-tight p-4">
              <p className="label">Total curated</p>
              <p className="mt-1.5 font-display text-xl font-semibold text-white">
                {fmtCpt(totalStake)} <span className="text-xs text-white/40">CPT</span>
              </p>
            </div>
            <div className="panel-tight p-4">
              <p className="label">Top campaign</p>
              <p className="mt-1.5 font-display text-xl font-semibold text-pulse-magenta">
                {topId ? `#${topId}` : "none"}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2 text-[11.5px] text-white/40">
            <p className="flex items-center gap-2">
              <Flame size={13} className="text-pulse-magenta" /> Ranking is recomputed by one shared
              sync helper, never by the caller.
            </p>
            <p className="flex items-center gap-2">
              <TrendingUp size={13} className="text-pulse-emerald" /> Brands and creators cannot curate
              their own campaign.
            </p>
            <p className="flex items-center gap-2">
              <Sparkles size={13} className="text-pulse-violet" /> Curation after settlement reverts by
              design.
            </p>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="label">Curated feed ranking</p>
              <p className="mt-1 text-[11px] text-white/35">evaluated campaigns only</p>
            </div>
            <span className="chip">
              <Crown size={12} className="text-pulse-amber" /> {feed.length} ranked
            </span>
          </div>

          <div className="space-y-2.5">
            {feed.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/35">
                The feed unlocks after the first validator audit finalizes.
              </div>
            )}
            {feed.map((entry, index) => {
              const share = totalStake ? (entry.curation_stake_total_atto / totalStake) * 100 : 0;
              return (
                <div
                  key={entry.campaign_id}
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 transition ${
                    entry.campaign_id === topId
                      ? "border-pulse-magenta/40 bg-pulse-magenta/[0.06]"
                      : "border-white/[0.07] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-white">
                        <span className="font-mono text-[10px] text-white/35">#{index + 1}</span>
                        <span className="truncate">{entry.title}</span>
                        {entry.campaign_id === topId && <Crown size={13} className="shrink-0 text-pulse-amber" />}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-white/35">
                        <span className="font-mono text-pulse-magenta">{entry.brand_tag_token}</span>
                        <span className={`chip border ${BAND_TONE[entry.campaign_band] ?? ""} !px-1.5 !py-0 text-[9.5px]`}>
                          {BAND_LABEL[entry.campaign_band] ?? entry.campaign_band}
                        </span>
                        <span>organic {entry.organic_authenticity}</span>
                        <span>velocity {entry.viral_velocity}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[12.5px] text-pulse-emerald">
                        {fmtCpt(entry.curation_stake_total_atto)}
                      </p>
                      <p className="text-[9.5px] uppercase tracking-wider text-white/30">CPT staked</p>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pulse-magenta to-pulse-violet"
                      style={{ width: `${Math.max(4, share)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
