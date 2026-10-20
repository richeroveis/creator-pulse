/**
 * Deployment identity. CONTRACT_ADDRESS and CONTRACT_SHA256 are rewritten by
 * scripts/deploy_studionet.py once the live studionet deployment finalizes so
 * the page, the evidence file and the repository all describe the same code.
 */
export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0x110C9EFa897A5Eab9b7f8019e70A43EB994f181B";

export const CONTRACT_SHA256 =
  (import.meta.env.VITE_CONTRACT_SHA256 as string | undefined) ?? "14bf5153b84d7167231d427c2899d97d9514e828efe463d1c274b4e8d4718c33";

export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const REPO_URL = "https://github.com/richeroveis/creator-pulse";
export const ATTO = 10 ** 18;

export const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
