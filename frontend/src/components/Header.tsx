import { useState } from "react";
import {
  AudioLines,
  ChevronDown,
  Copy,
  LogOut,
  Wallet,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { fmtCpt, shortAddr } from "../lib/format";
import { sound } from "../lib/sound";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          sound.click();
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-md p-1 text-white/40 transition hover:text-white"
      aria-label="Copy address"
    >
      {copied ? <Copy size={13} className="text-pulse-emerald" /> : <Copy size={13} />}
    </button>
  );
}

export function Header({ api }: { api: PulseApi }) {
  const [audioOn, setAudioOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { wallet, balance, connectBurner, connectWalletConnect, disconnect, faucet, busy } = api;

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-midnight-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
        <a href="#top" className="group flex items-center gap-3">
          <img
            src="./logo.png"
            alt="CreatorPulse"
            className="h-10 w-10 rounded-xl ring-1 ring-white/10 transition group-hover:ring-pulse-magenta/50"
          />
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-semibold tracking-tight text-white">
              CreatorPulse
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
              Verified sponsorship settlement
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 text-sm text-white/60 lg:flex">
          {[
            ["#simulator", "What-If Studio"],
            ["#console", "Console"],
            ["#campaigns", "Campaigns"],
            ["#feed", "Curated Feed"],
            ["#guardlab", "Guard Lab"],
            ["#inspector", "Consensus"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onMouseEnter={() => sound.hover()}
              className="rounded-lg px-3 py-2 transition hover:bg-white/[0.05] hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const on = sound.toggle();
              setAudioOn(on);
              if (on) sound.click();
            }}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-white/70 transition hover:border-white/25 hover:text-white"
            title={audioOn ? "Mute ambient synth" : "Start ambient synth"}
            aria-label={audioOn ? "Mute ambient synth" : "Start ambient synth"}
          >
            {audioOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>

          {wallet ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((open) => !open);
                  sound.click();
                }}
                className="flex items-center gap-2.5 rounded-xl border border-pulse-emerald/30 bg-pulse-emerald/10 px-3 py-2 text-left transition hover:bg-pulse-emerald/15"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-pulse-emerald/20 text-pulse-emerald">
                  <AudioLines size={15} />
                </span>
                <span className="hidden sm:block">
                  <span className="block font-mono text-[11px] text-pulse-emerald">
                    {shortAddr(wallet.address)}
                  </span>
                  <span className="block text-[10px] text-white/50">
                    {balance === null ? "syncing CPT" : `${fmtCpt(balance, 0)} CPT`}
                  </span>
                </span>
                <ChevronDown size={14} className="text-white/40" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-midnight-850/95 p-2 shadow-ring backdrop-blur-xl">
                  <div className="flex items-center justify-between rounded-xl px-3 py-2">
                    <span className="font-mono text-[11px] text-white/70">
                      {shortAddr(wallet.address)}
                    </span>
                    <CopyButton value={wallet.address} />
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      await faucet(2000);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
                  >
                    <Zap size={14} className="text-pulse-amber" /> Claim 2,000 CPT faucet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      disconnect();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
                  >
                    <LogOut size={14} /> Detach wallet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  void connectWalletConnect();
                }}
                className="btn-ghost hidden px-3 py-2 sm:inline-flex"
              >
                <Wallet size={15} /> MetaMask
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  void connectBurner();
                }}
                className="btn-primary px-3 py-2"
              >
                <Zap size={15} /> 1-click burner
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
