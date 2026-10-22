/**
 * Deployment identity. CONTRACT_ADDRESS and CONTRACT_SHA256 are rewritten by
 * scripts/deploy_studionet.py once the live studionet deployment finalizes so
 * the page, the evidence file and the repository all describe the same code.
 */
export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0x6768EAdcFBF13aDEE460Bfd228f6653f3e013016";

export const CONTRACT_SHA256 =
  (import.meta.env.VITE_CONTRACT_SHA256 as string | undefined) ?? "ed4fcc08c72e4926329f9efc6c3a16ac7d0b6d57ef04abd03136d1d6ea0381aa";

export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const REPO_URL = "https://github.com/richeroveis/creator-pulse";
export const ATTO = 10 ** 18;

export const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
