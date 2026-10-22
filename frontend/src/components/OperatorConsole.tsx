import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CircleDollarSign,
  ClipboardList,
  Info,
  PlusCircle,
  Zap,
} from "lucide-react";
import type { PulseApi } from "../hooks/usePulse";
import { explorerTx } from "../config";
import { txShort } from "../lib/format";
import {
  GUARDRAILS,
  validateCreateCampaign,
  validateReward,
  type CreateFieldErrors,
} from "../lib/validation";
import { sound } from "../lib/sound";

type ResultState = {
  label: string;
  execution: string;
  hash?: string;
  error?: string;
  returned?: unknown;
};

function ResultPanel({ result }: { result: ResultState | null }) {
  if (!result) return null;
  const ok = !result.error && result.execution === "SUCCESS";
  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 font-mono text-[11px] leading-relaxed ${
        ok
          ? "border-pulse-emerald/30 bg-pulse-emerald/[0.06] text-pulse-emerald/90"
          : "border-pulse-magenta/30 bg-pulse-magenta/[0.07] text-pulse-magenta/90"
      }`}
    >
      <p className="text-white/70">
        {result.label}: {result.error ? "reverted" : result.execution}
      </p>
      {result.error && <p className="mt-1 break-words">{result.error}</p>}
      {ok && result.returned !== undefined && (
        <p className="mt-1 break-words text-white/50">
          returned {JSON.stringify(result.returned).slice(0, 220)}
        </p>
      )}
      {result.hash && (
        <a
          href={explorerTx(result.hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-pulse-ice underline"
        >
          tx {txShort(result.hash)}
        </a>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-[11px] text-pulse-magenta">{error}</p>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12.5px] text-white outline-none focus:border-pulse-violet/60";

export function OperatorConsole({ api }: { api: PulseApi }) {
  const { wallet, busy, createCampaign, transfer, faucet } = api;
  const defaultDeadline = useMemo(
    () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    [],
  );
  const [form, setForm] = useState({
    title: "NovaGlow winter ritual",
    tag: "#NovaGlow",
    spec:
      "Publish one 60 second vertical video that shows the product in use, keeps the sponsor tag visible on screen for the full runtime, and reports organic reach and engagement rate in the description.",
    base: 1200,
    viral: 800,
    bond: 120,
    deadline: defaultDeadline,
  });
  const [errors, setErrors] = useState<CreateFieldErrors>({});
  const [createResult, setCreateResult] = useState<ResultState | null>(null);

  const [transferForm, setTransferForm] = useState({ to: "", amount: 100 });
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<ResultState | null>(null);

  const submitCreate = async () => {
    const deadlineUnix = Math.floor(new Date(form.deadline).getTime() / 1000);
    const nextErrors = validateCreateCampaign({
      title: form.title,
      tag: form.tag,
      spec: form.spec,
      baseCpt: Number(form.base),
      viralCpt: Number(form.viral),
      bondCpt: Number(form.bond),
      deadlineUnix,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !wallet) {
      if (!wallet) api.setError("Connect a wallet first.");
      return;
    }
    setCreateResult({ label: "create_campaign", execution: "PENDING" });
    const result = await createCampaign({
      title: form.title.trim(),
      tag: form.tag.trim(),
      spec: form.spec.trim(),
      baseCpt: Number(form.base),
      viralCpt: Number(form.viral),
      bondCpt: Number(form.bond),
      deadlineUnix,
    });
    if (result) {
      setCreateResult({
        label: "create_campaign",
        execution: result.execution,
        hash: result.hash,
        error: result.error,
        returned: result.returned,
      });
    } else {
      setCreateResult({ label: "create_campaign", execution: "FAILED", error: "no receipt returned" });
    }
    sound.click();
  };

  const submitTransfer = async () => {
    if (!wallet) {
      api.setError("Connect a wallet first.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(transferForm.to.trim())) {
      setTransferError("Recipient must be a 20 byte hex address.");
      return;
    }
    const rewardError = validateReward(Number(transferForm.amount), "Amount", false);
    if (rewardError) {
      setTransferError(rewardError);
      return;
    }
    setTransferError(null);
    setTransferResult({ label: "transfer_tokens", execution: "PENDING" });
    const result = await transfer(transferForm.to.trim(), Number(transferForm.amount));
    setTransferResult(
      result
        ? { label: "transfer_tokens", execution: result.execution, hash: result.hash, error: result.error, returned: result.returned }
        : { label: "transfer_tokens", execution: "FAILED", error: "no receipt returned" },
    );
    sound.click();
  };

  return (
    <section id="console" className="mx-auto max-w-7xl px-5 py-14">
      <div className="mb-6">
        <p className="label">Operator console</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          Real inputs, real transactions
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
          Every field below is sent to the deployed studionet contract through genlayer-js
          writeContract, then polled to FINALIZED. Client validation mirrors the contract floors and
          ceilings, and the contract revert reason is shown if the chain still rejects.
        </p>
      </div>

      {!wallet && (
        <div className="mb-4 rounded-xl border border-pulse-amber/30 bg-pulse-amber/[0.06] px-4 py-3 text-[12px] text-pulse-amber/90">
          Connect the burner wallet or MetaMask from the header before sending any transaction.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <div className="flex items-center gap-2">
            <PlusCircle size={16} className="text-pulse-violet" />
            <h3 className="font-display text-lg font-semibold text-white">Create campaign</h3>
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="Brand name or title" error={errors.title}>
              <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Authenticated brand tag" error={errors.tag}>
              <input className={inputClass} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="#BrandTag" />
            </Field>
            <Field label="Brief text / required deliverable spec" error={errors.spec}>
              <textarea className={`${inputClass} min-h-24`} value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Base reward" error={errors.base}>
                <input type="number" className={inputClass} value={form.base} onChange={(e) => setForm({ ...form, base: Number(e.target.value) })} />
              </Field>
              <Field label="Viral pool" error={errors.viral}>
                <input type="number" className={inputClass} value={form.viral} onChange={(e) => setForm({ ...form, viral: Number(e.target.value) })} />
              </Field>
              <Field label="Creator bond" error={errors.bond}>
                <input type="number" className={inputClass} value={form.bond} onChange={(e) => setForm({ ...form, bond: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Submission deadline" error={errors.deadline}>
              <input type="datetime-local" className={inputClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
          </div>
          <p className="mt-3 font-mono text-[10.5px] text-white/35">
            floors: bond {GUARDRAILS.minBondCpt} CPT, deadline at least {GUARDRAILS.minWindowSeconds}s out. ceilings: reward {GUARDRAILS.maxRewardCpt.toLocaleString()} CPT, bond {GUARDRAILS.maxBondCpt.toLocaleString()} CPT.
          </p>
          <button
            type="button"
            disabled={busy !== null || !wallet}
            onClick={submitCreate}
            className="btn-primary mt-4 disabled:opacity-40"
          >
            <ClipboardList size={15} /> {busy === "Create campaign" ? "Awaiting consensus" : "Fund and create campaign"}
          </button>
          <ResultPanel result={createResult} />
        </div>

        <div className="panel p-6">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-pulse-ice" />
            <h3 className="font-display text-lg font-semibold text-white">Move CPT</h3>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-white/45">
            The capped test faucet credits a fresh burner so you can fund a campaign, post a bond, or
            stake on a deliverable without leaving the page.
          </p>
          <button
            type="button"
            disabled={busy !== null || !wallet}
            onClick={async () => {
              await faucet(2000);
              sound.click();
            }}
            className="btn-ghost mt-4 disabled:opacity-40"
          >
            <Zap size={15} /> Claim 2,000 CPT faucet
          </button>

          <div className="mt-6 grid gap-3">
            <Field label="Recipient address" error={transferError ?? undefined}>
              <input className={inputClass} value={transferForm.to} onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })} placeholder="0x..." />
            </Field>
            <Field label="Amount in CPT">
              <input type="number" className={inputClass} value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })} />
            </Field>
          </div>
          <button
            type="button"
            disabled={busy !== null || !wallet}
            onClick={submitTransfer}
            className="btn-ghost mt-4 disabled:opacity-40"
          >
            <CircleDollarSign size={15} /> Transfer CPT
          </button>
          <ResultPanel result={transferResult} />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5">
        <Info size={16} className="mt-0.5 shrink-0 text-pulse-violet" />
        <p className="text-[12px] leading-relaxed text-white/55">
          <span className="font-semibold text-white/80">How proofs work.</span> GenLayer validators
          independently fetch the proof URL you submit, so it must be a public absolute https page
          they can all reach. Host the proof page under <code className="font-mono text-pulse-ice/80">frontend/public/proofs</code> in this repo, or on any other public https host. If the
          page is genuinely unreachable for everyone, the neutral recovery paths on each campaign card
          return the bond to the creator and the vault to the brand after the audit window passes.
        </p>
      </div>
    </section>
  );
}
