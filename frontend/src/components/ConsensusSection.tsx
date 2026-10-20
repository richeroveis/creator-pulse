import { Binary, Braces, GitCompareArrows, Globe2, ScanEye, ShieldCheck } from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { BAND_LABEL, BAND_TONE } from "../lib/format";
import { sound } from "../lib/sound";

const STEPS = [
  {
    icon: Globe2,
    title: "Render the proof",
    body: "gl.nondet.web.render fetches the submitted URL in text mode on every validator, not just the leader.",
  },
  {
    icon: ShieldCheck,
    title: "Check the disclosure",
    body: "The authenticated brand tag must appear in the rendered text. Absence forces the slash band.",
  },
  {
    icon: Binary,
    title: "Score the ladder",
    body: "The model must answer with one of four anchors. Malformed JSON reverts instead of guessing.",
  },
  {
    icon: GitCompareArrows,
    title: "Compare exactly",
    body: "prompt_comparative requires identical campaign_band, quality_anchor and disclosure_verified.",
  },
  {
    icon: Braces,
    title: "Split deterministically",
    body: "One pure helper turns the agreed anchor into creator payout and brand refund, then the vault pays.",
  },
];

export function ConsensusSection({ api, onInspect }: { api: PulseApi; onInspect: (id: number) => void }) {
  const campaigns = api.dashboard?.campaigns ?? [];

  return (
    <section id="inspector" className="mx-auto max-w-7xl px-5 py-14">
      <div className="mb-6">
        <p className="label">Consensus and prompt inspector</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          How a deliverable becomes a payout
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
          The audit path is deliberately narrow. Storage is snapshotted before consensus, the external
          evidence is re-fetched by validators, and the only values that move money are the three fields
          the equivalence principle pins down.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {STEPS.map((step, index) => (
          <div key={step.title} className="panel relative p-4">
            <span className="absolute right-3 top-3 font-mono text-[10px] text-white/20">
              0{index + 1}
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-pulse-violet">
              <step.icon size={16} />
            </span>
            <p className="mt-3 font-display text-[13.5px] font-semibold text-white">{step.title}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/45">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="panel mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Live verdicts</p>
            <p className="mt-1 text-[11.5px] text-white/40">
              Open any campaign to see the exact prompt, the principle and the stored snapshot.
            </p>
          </div>
          <span className="chip">
            <ScanEye size={12} /> {campaigns.filter((campaign) => campaign.evaluated).length} audited
          </span>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.length === 0 && (
            <p className="text-sm text-white/35">Campaigns appear here once the seed script finalizes.</p>
          )}
          {campaigns.map((campaign) => (
            <button
              key={campaign.campaign_id}
              type="button"
              onClick={() => {
                onInspect(campaign.campaign_id);
                sound.click();
              }}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-left transition hover:border-white/20"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-white">
                  <span className="mr-2 font-mono text-[10px] text-white/30">#{campaign.campaign_id}</span>
                  {campaign.title}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-white/35">
                  {campaign.evaluated
                    ? `anchor ${campaign.quality_anchor} / ${campaign.disclosure_verified ? "tag ok" : "tag missing"}`
                    : campaign.state.toLowerCase()}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-wider ${
                  BAND_TONE[campaign.campaign_band] ?? "border-white/10 text-white/40"
                }`}
              >
                {campaign.campaign_band ? BAND_LABEL[campaign.campaign_band] : "pending"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
