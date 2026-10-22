import { useMemo, useState } from "react";
import { BadgeCheck, CircleDollarSign, Link2, RotateCcw, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { BAND_LABEL, BAND_TONE, computeBand, cpt, fmtCptValue } from "../lib/format";
import { sound } from "../lib/sound";

const ANCHORS = [
  { value: 100, label: "100", hint: "Viral hit" },
  { value: 80, label: "80", hint: "Target met" },
  { value: 50, label: "50", hint: "Partial" },
  { value: 0, label: "0", hint: "Bot or missing tag" },
];

const PRESETS = [
  { name: "Viral hit", base: 1200, viral: 800, bond: 120, anchor: 100, disclosure: true },
  { name: "Target met", base: 900, viral: 400, bond: 100, anchor: 80, disclosure: true },
  { name: "Half delivery", base: 900, viral: 400, bond: 100, anchor: 50, disclosure: true },
  { name: "Bot farm", base: 900, viral: 400, bond: 100, anchor: 100, disclosure: false },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
        <span className="font-mono text-xs text-white/70">
          {value.toLocaleString("en-US")} {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2.5 w-full"
      />
    </label>
  );
}

export function Simulator({ api }: { api: PulseApi }) {
  const [base, setBase] = useState(1200);
  const [viral, setViral] = useState(800);
  const [bond, setBond] = useState(120);
  const [anchor, setAnchor] = useState(100);
  const [disclosure, setDisclosure] = useState(true);
  const [onChain, setOnChain] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const outcome = useMemo(
    () => computeBand(anchor, disclosure, base, viral, bond),
    [anchor, disclosure, base, viral, bond],
  );
  const total = base + viral + bond;
  const creatorShare = total ? (outcome.creator / total) * 100 : 0;

  const verify = async () => {
    setChecking(true);
    sound.click();
    const result = await api.previewBand(base, viral, bond, outcome.anchor, disclosure);
    setChecking(false);
    if (result) {
      const chainCreator = Math.round(cpt(Number(result.creator_payout)));
      const chainBrand = Math.round(cpt(Number(result.brand_refund)));
      const matches =
        result.campaign_band === outcome.band &&
        chainCreator === Math.round(outcome.creator) &&
        chainBrand === Math.round(outcome.brand);
      setOnChain(
        matches
          ? `on-chain helper agrees: ${result.campaign_band} pays ${fmtCptValue(chainCreator)} CPT to the creator and ${fmtCptValue(chainBrand)} CPT to the brand`
          : `drift detected: chain says ${result.campaign_band} with ${fmtCptValue(chainCreator)} CPT to the creator`,
      );
      if (matches) sound.success();
      else sound.error();
    }
  };

  return (
    <section id="simulator" className="mx-auto max-w-7xl px-5 py-14">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Interactive what-if studio</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
            Simulate the exact payout band
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Illustration only. This studio mirrors the shared helper so you can see how a band would
            split base reward, viral bonus pool and the creator bond. It never moves funds. Real money
            only moves through the audited on chain settlement actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setBase(preset.base);
                setViral(preset.viral);
                setBond(preset.bond);
                setAnchor(preset.anchor);
                setDisclosure(preset.disclosure);
                setOnChain(null);
                sound.click();
              }}
              className="chip transition hover:border-pulse-violet/50 hover:text-white"
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setBase(1200);
              setViral(800);
              setBond(120);
              setAnchor(100);
              setDisclosure(true);
              setOnChain(null);
              sound.click();
            }}
            className="chip transition hover:text-white"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Slider label="Base reward" value={base} min={100} max={4000} step={50} suffix="CPT" onChange={setBase} />
            <Slider label="Viral bonus pool" value={viral} min={0} max={3000} step={50} suffix="CPT" onChange={setViral} />
            <Slider label="Creator anti-bot bond" value={bond} min={25} max={600} step={5} suffix="CPT" onChange={setBond} />
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Disclosure tag
              </span>
              <button
                type="button"
                onClick={() => {
                  setDisclosure((value) => !value);
                  setOnChain(null);
                  sound.click();
                }}
                className={`mt-2.5 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition ${
                  disclosure
                    ? "border-pulse-emerald/40 bg-pulse-emerald/10 text-pulse-emerald"
                    : "border-pulse-magenta/40 bg-pulse-magenta/10 text-pulse-magenta"
                }`}
              >
                <span>{disclosure ? "Authenticated tag found" : "Tag missing"}</span>
                <span className="font-mono text-[11px]">{disclosure ? "verified" : "slash"}</span>
              </button>
            </div>
          </div>

          <div className="mt-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Quality anchor ladder
            </span>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {ANCHORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAnchor(option.value);
                    setOnChain(null);
                    sound.click();
                  }}
                  className={`rounded-xl border px-2 py-3 text-center transition ${
                    anchor === option.value
                      ? "border-pulse-violet/60 bg-pulse-violet/15 text-white shadow-[0_0_24px_-12px_rgba(139,92,246,0.9)]"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25"
                  }`}
                >
                  <span className="block font-display text-lg font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[9.5px] uppercase tracking-wider opacity-70">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/[0.07] bg-black/20 p-4">
            <div className="flex items-center justify-between text-[11px] text-white/40">
              <span>Creator share</span>
              <span>Brand refund</span>
            </div>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full bg-gradient-to-r from-pulse-emerald/80 to-pulse-emerald transition-all duration-500"
                style={{ width: `${creatorShare}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-pulse-violet/70 to-pulse-magenta/70 transition-all duration-500"
                style={{ width: `${100 - creatorShare}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between font-mono text-xs">
              <span className="text-pulse-emerald">{fmtCptValue(outcome.creator)} CPT</span>
              <span className="text-white/35">{fmtCptValue(total)} CPT locked</span>
              <span className="text-pulse-violet">{fmtCptValue(outcome.brand)} CPT</span>
            </div>
          </div>
        </div>

        <div className="panel relative overflow-hidden p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pulse-emerald/60 to-transparent" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Settlement verdict</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
                {BAND_LABEL[outcome.band ?? ""] ?? "Select an anchor"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-white/35">{outcome.band}</p>
            </div>
            <span className={`chip border ${BAND_TONE[outcome.band ?? ""] ?? ""}`}>
              <BadgeCheck size={12} /> anchor {outcome.anchor}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="panel-tight p-4">
              <p className="label">Creator receives</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-pulse-emerald">
                {fmtCptValue(outcome.creator)}
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                {bond > 0 ? `includes the ${fmtCptValue(bond)} CPT bond` : "no bond"}
              </p>
            </div>
            <div className="panel-tight p-4">
              <p className="label">Brand refund</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-pulse-violet">
                {fmtCptValue(outcome.brand)}
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                {outcome.bonusReleased ? "viral pool paid out" : "viral pool returned"}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-[12.5px] leading-relaxed text-white/55">
            <p className="flex items-start gap-2">
              <CircleDollarSign size={15} className="mt-0.5 shrink-0 text-pulse-ice" />
              Conservation: {fmtCptValue(outcome.creator)} + {fmtCptValue(outcome.brand)} ={" "}
              {fmtCptValue(outcome.creator + outcome.brand)} CPT, equal to base reward plus viral pool plus bond.
            </p>
            <p className="flex items-start gap-2">
              <ShieldAlert size={15} className="mt-0.5 shrink-0 text-pulse-amber" />
              {disclosure
                ? "The brand tag is present, so the quality anchor controls the band."
                : "A missing disclosure forces the slash band regardless of the model score."}
            </p>
            <p className="flex items-start gap-2">
              <TrendingUp size={15} className="mt-0.5 shrink-0 text-pulse-violet" />
              The brand cannot claw this vault back while the deliverable is awaiting audit or inside
              the post-audit dispute window.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={verify} disabled={checking} className="btn-emerald">
              <Link2 size={15} /> {checking ? "Querying helper" : "Verify against chain"}
            </button>
            <span className="text-[11px] text-white/35">one read call, no abi override</span>
          </div>

          {onChain && (
            <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 font-mono text-[11px] text-white/60">
              {onChain}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2 text-[11px] text-white/30">
            <Sparkles size={12} /> Illustration only. This preview never settles anything; on chain settlement reads the same helper from storage.
          </div>
        </div>
      </div>
    </section>
  );
}
