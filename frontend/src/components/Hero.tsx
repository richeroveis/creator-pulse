import { ArrowUpRight, Database, Fingerprint, Radar, ShieldCheck, Sparkles } from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { CONTRACT_ADDRESS, CONTRACT_SHA256, REPO_URL, explorerAddress } from "../config";
import { fmtCpt, shortAddr, type Campaign } from "../lib/format";

function Ring({
  radius,
  value,
  color,
  width = 6,
  offset = 0,
}: {
  radius: number;
  value: number;
  color: string;
  width?: number;
  offset?: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;
  return (
    <g transform={`rotate(${offset} 120 120)`}>
      <circle cx="120" cy="120" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={width} />
      <circle
        cx="120"
        cy="120"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        style={{ filter: `drop-shadow(0 0 6px ${color}66)`, transition: "stroke-dasharray 900ms ease" }}
      />
    </g>
  );
}

export function Hero({ api }: { api: PulseApi }) {
  const { dashboard, loading, updatedAt } = api;
  const campaigns = dashboard?.campaigns ?? [];
  const evaluated = campaigns.filter((item) => item.evaluated);
  const avg = (pick: (item: Campaign) => number) =>
    evaluated.length ? evaluated.reduce((sum, item) => sum + pick(item), 0) / evaluated.length : 0;

  const authenticity = avg((item) => item.organic_authenticity);
  const velocity = avg((item) => item.viral_velocity);
  const vaultShare = dashboard
    ? Math.min(100, (dashboard.stats.vault_custody_balance_atto / (6000 * 10 ** 18)) * 100)
    : 0;

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-pulse-magenta/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-pulse-violet/20 blur-[130px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="chip border-pulse-magenta/30 bg-pulse-magenta/10 text-pulse-magenta">
              <Sparkles size={12} /> GenLayer Studionet
            </span>
            <span className="chip">
              <ShieldCheck size={12} className="text-pulse-emerald" /> Validator verified payouts
            </span>
            <span className="chip">
              <Database size={12} className="text-pulse-ice" /> Chain 61999
            </span>
          </div>

          <h1 className="max-w-2xl font-display text-[42px] font-semibold leading-[1.04] tracking-tight text-white sm:text-[54px]">
            Sponsorship money that settles on{" "}
            <span className="bg-gradient-to-r from-pulse-magenta via-pulse-violet to-pulse-emerald bg-clip-text text-transparent">
              proof, not promises.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/60">
            Brands fund a campaign vault with a base reward and a viral bonus pool. Creators post a
            deliverable and lock an anti-bot bond. Independent validators re-render the proof page,
            score the delivery on a four anchor ladder, and release exactly the band they agree on.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#simulator" className="btn-primary">
              <Radar size={16} /> Model a payout
            </a>
            <a href="#campaigns" className="btn-ghost">
              <Sparkles size={16} /> Open campaign board
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-ghost">
              <ArrowUpRight size={16} /> Source and evidence
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-[11px] text-white/40">
            <a
              href={explorerAddress(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono transition hover:border-white/25 hover:text-white/70"
            >
              <Fingerprint size={13} className="text-pulse-violet" />
              {shortAddr(CONTRACT_ADDRESS)}
            </a>
            <span className="font-mono">
              sha256 {CONTRACT_SHA256 === "pending" ? "pending deployment" : CONTRACT_SHA256.slice(0, 16)}
            </span>
            <span>{updatedAt ? `synced ${new Date(updatedAt).toLocaleTimeString("en-GB", { hour12: false })}` : loading ? "syncing" : "not synced"}</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[460px]">
          <div className="panel relative overflow-hidden p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pulse-magenta/60 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Vault custody</p>
                <p className="metric mt-1">
                  {fmtCpt(dashboard?.stats.vault_custody_balance_atto)} <span className="text-sm font-medium text-white/40">CPT</span>
                </p>
              </div>
              <span className="chip border-pulse-emerald/30 text-pulse-emerald">
                <span className="h-1.5 w-1.5 animate-pulseSlow rounded-full bg-pulse-emerald" /> live
              </span>
            </div>

            <svg viewBox="0 0 240 240" className="mx-auto mt-4 h-[260px] w-full">
              <defs>
                <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FF3DCE" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#FF3DCE" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="120" cy="120" r="72" fill="url(#coreGlow)" />
              <Ring radius={86} value={vaultShare} color="#FF3DCE" width={7} offset={-90} />
              <Ring radius={68} value={authenticity} color="#34F5B0" width={6} offset={-40} />
              <Ring radius={50} value={velocity} color="#8B5CF6" width={5} offset={20} />
              <g className="origin-center animate-orbitSlow">
                <circle cx="120" cy="34" r="3.5" fill="#34F5B0" />
              </g>
              <g className="origin-center animate-orbit">
                <circle cx="200" cy="120" r="3" fill="#FF3DCE" />
              </g>
              <text x="120" y="112" textAnchor="middle" className="fill-white font-display" fontSize="16" fontWeight="600">
                {evaluated.length}
              </text>
              <text x="120" y="130" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9.5" letterSpacing="2">
                AUDITED
              </text>
            </svg>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Organic", authenticity, "text-pulse-emerald"],
                ["Velocity", velocity, "text-pulse-violet"],
                ["Vault", vaultShare, "text-pulse-magenta"],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="panel-tight px-2 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
                  <p className={`font-display text-lg font-semibold ${tone as string}`}>
                    {Math.round(Number(value))}
                    <span className="text-[10px] text-white/30">/100</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-5 pb-12 lg:grid-cols-4">
        {[
          ["Campaigns seeded", String(dashboard?.stats.campaign_count ?? 0), "campaigns on studionet"],
          ["Vault custody", `${fmtCpt(dashboard?.stats.vault_custody_balance_atto)} CPT`, "locked or awaiting claim"],
          ["Settled volume", `${fmtCpt(dashboard?.stats.total_settled_atto)} CPT`, "released by consensus"],
          ["Slashed bonds", `${fmtCpt(dashboard?.stats.total_slashed_bond_atto)} CPT`, "anti-bot penalties"],
        ].map(([label, value, hint]) => (
          <div key={label} className="panel px-4 py-4">
            <p className="label">{label}</p>
            <p className="mt-1.5 font-display text-xl font-semibold text-white">{value}</p>
            <p className="mt-0.5 text-[11px] text-white/35">{hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
