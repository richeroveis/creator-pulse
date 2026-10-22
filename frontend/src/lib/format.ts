export const CPT = 10 ** 18;

export type CampaignBand =
  | "VIRAL_BONUS_TIER"
  | "TARGET_MET_TIER"
  | "PARTIAL_DELIVERY_TIER"
  | "BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH"
  | "";

export interface Campaign {
  campaign_id: number;
  brand: string;
  title: string;
  brand_tag_token: string;
  required_deliverable_spec: string;
  base_reward_atto: number;
  viral_bonus_pool_atto: number;
  required_creator_bond_atto: number;
  submission_deadline_clock: number;
  creator: string;
  content_proof_url: string;
  state: string;
  quality_anchor: number;
  disclosure_verified: boolean;
  campaign_band: CampaignBand;
  creator_payout_atto: number;
  brand_refund_atto: number;
  curation_stake_total_atto: number;
  curation_refunded_atto: number;
  viral_velocity: number;
  organic_authenticity: number;
  audit_evidence: string;
  evaluated: boolean;
  settled: boolean;
  vault_locked_atto: number;
  max_liability_atto: number;
  created_clock: number;
  submitted_clock: number;
  evaluated_clock: number;
  settlement_unlock_clock: number;
  recovered: boolean;
  recovered_clock: number;
}

export interface FeedEntry {
  campaign_id: number;
  title: string;
  brand_tag_token: string;
  campaign_band: CampaignBand;
  curation_stake_total_atto: number;
  viral_velocity: number;
  organic_authenticity: number;
  quality_anchor?: number;
  creator?: string;
  brand?: string;
}

export interface Stats {
  campaign_count: number;
  vault_custody_balance_atto: number;
  top_curated_campaign_id: number;
  top_curated_stake_atto: number;
  total_settled_atto: number;
  total_slashed_bond_atto: number;
  audit_count: number;
}

export interface DashboardConfig {
  atto_per_cpt: number;
  faucet_cap_atto: number;
  min_creator_bond_atto: number;
  min_curation_stake_atto: number;
  dispute_window_seconds: number;
  bands: CampaignBand[];
  anchors: number[];
}

export interface Dashboard {
  stats: Stats;
  campaigns: Campaign[];
  feed: FeedEntry[];
  config: DashboardConfig;
}

export const BAND_LABEL: Record<string, string> = {
  VIRAL_BONUS_TIER: "Viral bonus",
  TARGET_MET_TIER: "Target met",
  PARTIAL_DELIVERY_TIER: "Partial delivery",
  BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH: "Slash",
};

export const BAND_TONE: Record<string, string> = {
  VIRAL_BONUS_TIER: "text-pulse-emerald border-pulse-emerald/40 bg-pulse-emerald/10",
  TARGET_MET_TIER: "text-pulse-ice border-pulse-ice/40 bg-pulse-ice/10",
  PARTIAL_DELIVERY_TIER: "text-pulse-amber border-pulse-amber/40 bg-pulse-amber/10",
  BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH: "text-pulse-magenta border-pulse-magenta/40 bg-pulse-magenta/10",
};

export const STATE_TONE: Record<string, string> = {
  OPEN: "text-pulse-ice",
  SUBMITTED: "text-pulse-amber",
  EVALUATED: "text-pulse-violet",
  SETTLED: "text-pulse-emerald",
  CANCELLED: "text-white/40",
  RECOVERED: "text-pulse-ice",
};

/**
 * Mirror of the contract side _compute_campaign_band helper. It is used only
 * for the what if simulator preview; every real settlement reads the on chain
 * value so a UI drift can never move funds.
 */
export function computeBand(
  anchor: number,
  disclosure: boolean,
  base: number,
  viral: number,
  bond: number,
) {
  if (!disclosure || anchor <= 0) {
    return {
      band: "BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH" as CampaignBand,
      anchor: 0,
      creator: 0,
      brand: base + viral + bond,
      bonusReleased: false,
    };
  }
  if (anchor >= 100) {
    return {
      band: "VIRAL_BONUS_TIER" as CampaignBand,
      anchor: 100,
      creator: base + viral + bond,
      brand: 0,
      bonusReleased: true,
    };
  }
  if (anchor >= 80) {
    return {
      band: "TARGET_MET_TIER" as CampaignBand,
      anchor: 80,
      creator: base + bond,
      brand: viral,
      bonusReleased: false,
    };
  }
  const half = Math.floor(base / 2);
  return {
    band: "PARTIAL_DELIVERY_TIER" as CampaignBand,
    anchor: 50,
    creator: half + bond,
    brand: base - half + viral,
    bonusReleased: false,
  };
}

export function cpt(atto: number | string | undefined | null): number {
  const value = Number(atto ?? 0);
  if (!Number.isFinite(value)) return 0;
  return value / CPT;
}

export function fmtCpt(atto: number | string | undefined | null, digits = 0): string {
  return fmtCptValue(cpt(atto), digits);
}

export function fmtCptValue(value: number, digits = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function shortAddr(value: string | undefined | null): string {
  if (!value) return "0x0000...0000";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function relativeClock(unixSeconds: number): string {
  if (!unixSeconds) return "not scheduled";
  const delta = unixSeconds * 1000 - Date.now();
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const phrase = days >= 1 ? `${days}d` : hours >= 1 ? `${hours}h` : `${minutes}m`;
  return delta >= 0 ? `in ${phrase}` : `${phrase} ago`;
}

export function txShort(hash: string): string {
  return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : hash;
}
