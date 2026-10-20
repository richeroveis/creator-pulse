import { Activity, CheckCircle2, ExternalLink, RefreshCw, Terminal, XCircle } from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { CONTRACT_ADDRESS, CONTRACT_SHA256, EXPLORER_URL, isDeployed } from "../config";
import { explorerTx, explorerAddress } from "../config";
import { shortAddr, txShort } from "../lib/format";
import { sound } from "../lib/sound";

const TONE = {
  info: "text-pulse-ice",
  success: "text-pulse-emerald",
  error: "text-pulse-magenta",
  chain: "text-pulse-violet",
};

export function ActivityPanel({ api }: { api: PulseApi }) {
  const { log, dashboard, refresh, loading, updatedAt, error } = api;

  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Session activity</p>
              <p className="mt-1 text-[11.5px] text-white/35">
                {updatedAt ? `last sync ${new Date(updatedAt).toLocaleTimeString("en-GB", { hour12: false })}` : "not synced yet"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.click();
                void refresh();
              }}
              disabled={loading}
              className="chip transition hover:border-white/30 hover:text-white"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> refresh
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {log.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[12px] text-white/35">
                Connect a wallet and run a probe. Every transaction hash lands here.
              </div>
            )}
            {log.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                <span className={`mt-0.5 ${TONE[entry.kind]}`}>
                  {entry.kind === "success" ? (
                    <CheckCircle2 size={14} />
                  ) : entry.kind === "error" ? (
                    <XCircle size={14} />
                  ) : entry.kind === "chain" ? (
                    <Terminal size={14} />
                  ) : (
                    <Activity size={14} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-white/80">
                    <span className="font-mono text-[10px] text-white/30">{entry.at}</span>
                    {entry.title}
                  </p>
                  {entry.detail && (
                    <p className="mt-0.5 break-words font-mono text-[10.5px] leading-relaxed text-white/40">
                      {entry.detail}
                    </p>
                  )}
                </div>
                {entry.hash && (
                  <a
                    href={explorerTx(entry.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-mono text-[10px] text-pulse-ice/70 transition hover:text-pulse-ice"
                    title={entry.hash}
                  >
                    {txShort(entry.hash)}
                  </a>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-pulse-magenta/30 bg-pulse-magenta/[0.08] px-3.5 py-2.5 text-[11.5px] text-pulse-magenta/90">
              {error}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <p className="label">System manifest</p>
          <div className="mt-3 space-y-2.5 text-[11.5px]">
            {[
              ["Network", "GenLayer Studionet"],
              ["Chain id", "61999"],
              ["Contract", shortAddr(CONTRACT_ADDRESS)],
              ["Code sha256", CONTRACT_SHA256 === "pending" ? "pending" : `${CONTRACT_SHA256.slice(0, 20)}...`],
              ["Bands", "4 anchors"],
              ["Dispute window", `${dashboard?.config.dispute_window_seconds ?? 90}s`],
              ["Faucet cap", `${Math.round((dashboard?.config.faucet_cap_atto ?? 400000 * 10 ** 18) / 10 ** 18).toLocaleString()} CPT`],
              ["Min bond", `${Math.round((dashboard?.config.min_creator_bond_atto ?? 25 * 10 ** 18) / 10 ** 18)} CPT`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-white/[0.05] pb-2 last:border-0">
                <span className="text-white/35">{label}</span>
                <span className="font-mono text-white/70">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={isDeployed ? explorerAddress(CONTRACT_ADDRESS) : EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
              className="chip transition hover:text-white"
            >
              <ExternalLink size={11} /> explorer
            </a>
            <a
              href="https://github.com/richeroveis/creator-pulse/blob/main/evidence/studionet_deployment.json"
              target="_blank"
              rel="noreferrer"
              className="chip transition hover:text-white"
            >
              <ExternalLink size={11} /> evidence json
            </a>
          </div>

          <p className="mt-4 text-[10.5px] leading-relaxed text-white/30">
            Reads are batched: the whole board, feed and config come from a single get_dashboard call on
            page load, then only explicit actions touch the RPC.
          </p>
        </div>
      </div>
    </section>
  );
}
