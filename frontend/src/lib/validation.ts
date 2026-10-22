// Client mirrors of the contract guardrails. These only pre-fill the UI with a
// clear message before a transaction is signed. The contract is always the
// authority: if the chain disagrees it reverts and the revert reason is shown.

export const CPT = 10 ** 18;

export const GUARDRAILS = {
  titleMin: 4,
  titleMax: 120,
  tagMin: 2,
  tagMax: 41,
  specMin: 20,
  specMax: 900,
  maxRewardCpt: 2_000_000,
  minBondCpt: 25,
  maxBondCpt: 250_000,
  minStakeCpt: 5,
  maxStakeCpt: 100_000,
  minWindowSeconds: 300,
  maxWindowSeconds: 60 * 60 * 24 * 90,
  proofUrlMin: 12,
  proofUrlMax: 300,
};

const collapse = (value: string): string => value.trim().replace(/\s+/g, " ");

export function validateTag(tag: string): string | null {
  const text = tag.trim();
  if (text.length < GUARDRAILS.tagMin || text.length > GUARDRAILS.tagMax) {
    return "Brand tag must be 2 to 41 characters.";
  }
  if (!text.startsWith("#")) {
    return "Brand tag must start with a hash symbol.";
  }
  if (!/^#[A-Za-z0-9_]+$/.test(text)) {
    return "Brand tag may only use letters, digits and underscore.";
  }
  return null;
}

export function validateTitle(title: string): string | null {
  const text = collapse(title);
  if (text.length < GUARDRAILS.titleMin || text.length > GUARDRAILS.titleMax) {
    return "Title must be 4 to 120 characters.";
  }
  return null;
}

export function validateSpec(spec: string): string | null {
  const text = collapse(spec);
  if (text.length < GUARDRAILS.specMin || text.length > GUARDRAILS.specMax) {
    return "Deliverable spec must be 20 to 900 characters.";
  }
  return null;
}

export function validateReward(cpt: number, label: string, allowZero: boolean): string | null {
  if (!Number.isFinite(cpt)) return `${label} must be a number.`;
  if (cpt < 0) return `${label} cannot be negative.`;
  if (!allowZero && cpt <= 0) return `${label} must be positive.`;
  if (cpt > GUARDRAILS.maxRewardCpt) return `${label} exceeds the campaign ceiling of 2,000,000 CPT.`;
  return null;
}

export function validateBond(cpt: number): string | null {
  if (!Number.isFinite(cpt)) return "Creator bond must be a number.";
  if (cpt < GUARDRAILS.minBondCpt) return "Creator bond is below the anti bot floor of 25 CPT.";
  if (cpt > GUARDRAILS.maxBondCpt) return "Creator bond exceeds the campaign ceiling of 250,000 CPT.";
  return null;
}

export function validateStake(cpt: number): string | null {
  if (!Number.isFinite(cpt)) return "Curation stake must be a number.";
  if (cpt < GUARDRAILS.minStakeCpt) return "Curation stake is below the minimum of 5 CPT.";
  if (cpt > GUARDRAILS.maxStakeCpt) return "Curation stake exceeds the ceiling of 100,000 CPT.";
  return null;
}

export function validateDeadline(unixSeconds: number): string | null {
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(unixSeconds)) return "Deadline must be a number.";
  if (unixSeconds < now + GUARDRAILS.minWindowSeconds) {
    return "Deadline is below the minimum campaign window of 5 minutes.";
  }
  if (unixSeconds > now + GUARDRAILS.maxWindowSeconds) {
    return "Deadline exceeds the maximum campaign window of 90 days.";
  }
  return null;
}

const PRIVATE_HOSTS = new Set(["localhost", "localhost.localdomain"]);

function isIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isPrivateHost(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (PRIVATE_HOSTS.has(bare) || bare.endsWith(".local") || bare.endsWith(".internal")) {
    return true;
  }
  if (isIpv4(bare)) {
    const [a, b] = bare.split(".").map(Number);
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 0) return true;
    return false;
  }
  // An IPv6 literal never contains a valid public domain shape here.
  if (bare.includes(":")) return true;
  return false;
}

// Mirrors the contract _clean_proof_url and rejects IP literals, embedded
// credentials and private hosts so a proof page is always genuinely public.
export function validateProofUrl(url: string): string | null {
  const text = url.trim();
  if (text.length < GUARDRAILS.proofUrlMin || text.length > GUARDRAILS.proofUrlMax) {
    return "Proof URL length is outside the allowed range of 12 to 300 characters.";
  }
  if (!text.startsWith("https://")) {
    return "Proof URL must use https.";
  }
  if (/[\s\t\n]/.test(text)) {
    return "Proof URL contains a forbidden whitespace character.";
  }
  const withoutScheme = text.slice("https://".length);
  if (withoutScheme.includes("@")) {
    return "Proof URL must not embed credentials.";
  }
  const host = withoutScheme.split("/")[0];
  if (!host.includes(".")) {
    return "Proof URL host is not a public domain.";
  }
  if (isPrivateHost(host)) {
    return "Proof URL host must be a public domain, not an IP literal or private host.";
  }
  return null;
}

export interface CreateFieldErrors {
  title?: string;
  tag?: string;
  spec?: string;
  base?: string;
  viral?: string;
  bond?: string;
  deadline?: string;
}

export function validateCreateCampaign(input: {
  title: string;
  tag: string;
  spec: string;
  baseCpt: number;
  viralCpt: number;
  bondCpt: number;
  deadlineUnix: number;
}): CreateFieldErrors {
  const errors: CreateFieldErrors = {};
  const title = validateTitle(input.title);
  if (title) errors.title = title;
  const tag = validateTag(input.tag);
  if (tag) errors.tag = tag;
  const spec = validateSpec(input.spec);
  if (spec) errors.spec = spec;
  const base = validateReward(input.baseCpt, "Base reward", false);
  if (base) errors.base = base;
  const viral = validateReward(input.viralCpt, "Viral bonus pool", true);
  if (viral) errors.viral = viral;
  const bond = validateBond(input.bondCpt);
  if (bond) errors.bond = bond;
  const deadline = validateDeadline(input.deadlineUnix);
  if (deadline) errors.deadline = deadline;
  return errors;
}
