import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const BURNER_KEY = "creatorpulse.burner.v1";

export type WalletKind = "burner" | "metamask";

export interface WalletSession {
  kind: WalletKind;
  address: string;
  client: ReturnType<typeof createClient>;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function readStoredKey(): `0x${string}` | null {
  try {
    const stored = window.localStorage.getItem(BURNER_KEY);
    if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
      return stored as `0x${string}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function createBurner(): WalletSession {
  let key = readStoredKey();
  if (!key) {
    key = generatePrivateKey();
    try {
      window.localStorage.setItem(BURNER_KEY, key);
    } catch {
      // private browsing, the burner simply lives for this tab
    }
  }
  const account = createAccount(key);
  const client = createClient({ chain: studionet, account });
  return { kind: "burner", address: account.address, client };
}

export function forgetBurner(): void {
  try {
    window.localStorage.removeItem(BURNER_KEY);
  } catch {
    // nothing to clear
  }
}

export async function connectMetaMask(): Promise<WalletSession> {
  const provider = window.ethereum;
  if (!provider) {
    throw new Error("MetaMask is not installed in this browser.");
  }
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("MetaMask returned no account.");
  }
  const address = accounts[0];
  const client = createClient({
    chain: studionet,
    provider,
    account: address as `0x${string}`,
  });
  return { kind: "metamask", address, client };
}

export function burnerKeyHint(): string {
  return "The burner key is generated in this browser, stored in localStorage, and never sent to a server.";
}
