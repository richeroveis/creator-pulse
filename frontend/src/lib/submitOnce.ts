/**
 * Idempotent submission guard for GenLayer writes.
 *
 * The problem this solves: a browser write has two steps, submit (which returns a
 * transaction hash) and watch that hash until FINALIZED. If the watch step errors on
 * the client (RPC hiccup, receipt polling timeout, page reload) a naive UI asks the
 * user to click again, which resubmits the SAME logical action and can land a
 * duplicate. On a contract that moves funds a duplicate is exactly what the reviewer
 * warned about.
 *
 * The rule enforced here, with no browser or genlayer-js dependency so it can be
 * tested in plain Node: for a given submission key the submit callback is called at
 * most once until the outcome resolves. A failed watch never resubmits, it keeps the
 * known hash pending so a later call (or a page reload) resumes by watching that hash
 * again. If even the submit step fails before a hash is known, an
 * AmbiguousSubmissionError is raised so the caller re-reads contract state instead of
 * blindly resubmitting.
 */

export type ReceiptOutcome = {
  status: string;
  execution: string;
  error?: string;
  returned?: unknown;
};

export type PendingRecord = {
  hash: string;
  functionName: string;
  campaignId: number | null;
  startedAt: number;
};

export interface PendingStore {
  get(key: string): PendingRecord | null;
  set(key: string, record: PendingRecord): void;
  clear(key: string): void;
  list(): Array<{ key: string; record: PendingRecord }>;
}

/**
 * Raised only when the submission itself failed before any hash was known. The caller
 * must re-read contract state, never resubmit blindly, because the transaction may in
 * fact have landed even though the client never saw the hash.
 */
export class AmbiguousSubmissionError extends Error {
  readonly clientMessage: string;

  constructor(clientMessage: string) {
    super(clientMessage);
    this.name = "AmbiguousSubmissionError";
    this.clientMessage = clientMessage;
  }
}

export type SubmitOnceArgs = {
  key: string;
  functionName: string;
  campaignId?: number | null;
  submit: () => Promise<string>;
  watch: (hash: string, onLine: (line: string) => void) => Promise<ReceiptOutcome>;
  store: PendingStore;
  onLine?: (line: string, hash?: string) => void;
};

export type SubmitOnceResult = {
  hash: string;
  outcome: ReceiptOutcome;
  resumed: boolean;
};

const PENDING = "PENDING";

function short(hash: string): string {
  return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : hash;
}

export async function submitOnce(args: SubmitOnceArgs): Promise<SubmitOnceResult> {
  const emit = (line: string, hash?: string) => args.onLine?.(line, hash);

  // 1. If this action already has an in flight hash, resume it. Never resubmit.
  const existing = args.store.get(args.key);
  if (existing && existing.hash) {
    emit(`resuming watch for pending ${short(existing.hash)}`, existing.hash);
    const outcome = await args.watch(existing.hash, (line) => emit(line, existing.hash));
    if (outcome.status !== PENDING) args.store.clear(args.key);
    return { hash: existing.hash, outcome, resumed: true };
  }

  // 2. No pending record: submit exactly once, then persist the hash immediately so a
  //    reload can resume from step 1 rather than submit a second time.
  let hash: string;
  try {
    hash = await args.submit();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AmbiguousSubmissionError(message);
  }
  args.store.set(args.key, {
    hash,
    functionName: args.functionName,
    campaignId: args.campaignId ?? null,
    startedAt: Date.now(),
  });
  emit(`submitted ${short(hash)}, waiting for FINALIZED`, hash);

  // 3. Watch the known hash. A polling error never triggers a resubmit, the hash stays
  //    pending so a reload resumes from step 1.
  let outcome: ReceiptOutcome;
  try {
    outcome = await args.watch(hash, (line) => emit(line, hash));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = { status: PENDING, execution: PENDING, error: message };
  }
  if (outcome.status !== PENDING) args.store.clear(args.key);
  return { hash, outcome, resumed: false };
}
