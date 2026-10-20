/**
 * Deployment identity. CONTRACT_ADDRESS and CONTRACT_SHA256 are rewritten by
 * scripts/deploy_studionet.py once the live studionet deployment finalizes so
 * the page, the evidence file and the repository all describe the same code.
 */
export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0x031B8ed9391b81fd89107B231F9573bD699e3F38";

export const CONTRACT_SHA256 =
  (import.meta.env.VITE_CONTRACT_SHA256 as string | undefined) ?? "66fab11723efa7bc3603a8537c2f98003649fe9339b2397829146539df1c4d65";

export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const REPO_URL = "https://github.com/richeroveis/creator-pulse";
export const ATTO = 10 ** 18;

export const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
