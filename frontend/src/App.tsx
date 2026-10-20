import { useEffect, useState } from "react";
import { AlertTriangle, Github, ShieldCheck, Sparkles, X } from "lucide-react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Simulator } from "./components/Simulator";
import { CampaignBoard } from "./components/CampaignBoard";
import { FeedRail } from "./components/FeedRail";
import { ConsensusSection } from "./components/ConsensusSection";
import { ConsensusDrawer } from "./components/ConsensusDrawer";
import { GuardLab } from "./components/GuardLab";
import { ActivityPanel } from "./components/ActivityPanel";
import { usePulse } from "./hooks/usePulse";
import { CONTRACT_SHA256, REPO_URL } from "./config";
import { sound } from "./lib/sound";

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-midnight-950/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <img src="./logo.png" alt="CreatorPulse" className="h-8 w-8 rounded-lg ring-1 ring-white/10" />
            <span className="font-display text-sm font-semibold tracking-tight text-white">CreatorPulse</span>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/40">
            AI verified brand sponsorship and creator campaign KPI settlement. Funds stay in custody
            until validators agree on the band, never because an admin signed off.
          </p>
          <p className="mt-3 font-mono text-[10px] text-white/25">
            code sha256 {CONTRACT_SHA256 === "pending" ? "pending" : CONTRACT_SHA256.slice(0, 24)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-[12px] text-white/45">
          <a href="#simulator" className="transition hover:text-white">What-If Studio</a>
          <a href={`${REPO_URL}`} target="_blank" rel="noreferrer" className="transition hover:text-white">
            Repository
          </a>
          <a href="#campaigns" className="transition hover:text-white">Campaign Board</a>
          <a
            href={`${REPO_URL}/blob/main/evidence/studionet_deployment.json`}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            Deployment Evidence
          </a>
          <a href="#guardlab" className="transition hover:text-white">Guard Lab</a>
          <a
            href={`${REPO_URL}/blob/main/README.md`}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            README
          </a>
        </div>

        <div className="flex flex-col gap-2 text-[11px] text-white/30">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-pulse-emerald" /> Studionet only, test assets
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={12} className="text-pulse-violet" /> Built on GenLayer intelligent contracts
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-white/60"
          >
            <Github size={12} /> richeroveis/creator-pulse
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const api = usePulse();
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (api.error) {
      setToast(api.error);
      const timer = window.setTimeout(() => setToast(null), 6500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [api.error]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = api.dashboard?.campaigns.find((campaign) => campaign.campaign_id === inspectId) ?? null;

  return (
    <div className="min-h-screen">
      <Header api={api} />
      <main>
        <Hero api={api} />
        <div className="mx-auto max-w-7xl px-5">
          <div className="hairline" />
        </div>
        <Simulator api={api} />
        <CampaignBoard api={api} onInspect={setInspectId} />
        <FeedRail api={api} />
        <ConsensusSection api={api} onInspect={setInspectId} />
        <GuardLab api={api} />
        <ActivityPanel api={api} />
      </main>
      <Footer />
      <ConsensusDrawer campaign={selected} onClose={() => setInspectId(null)} />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-40 w-[min(92vw,540px)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-2xl border border-pulse-magenta/35 bg-midnight-850/95 px-4 py-3 shadow-ring backdrop-blur-xl">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-pulse-magenta" />
            <p className="flex-1 font-mono text-[11px] leading-relaxed text-white/70">{toast}</p>
            <button
              type="button"
              onClick={() => {
                setToast(null);
                api.setError(null);
                sound.click();
              }}
              className="text-white/40 transition hover:text-white"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {api.busy && (
        <div className="fixed bottom-0 left-0 right-0 z-40 h-0.5 overflow-hidden bg-white/5">
          <div className="h-full w-1/3 animate-[orbit_1.4s_linear_infinite] bg-gradient-to-r from-pulse-magenta to-pulse-emerald" />
        </div>
      )}
    </div>
  );
}
