import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { STATE_DIR, STATE_PATH } from './config.js';

export interface Operation {
  kind: 'create' | 'mint' | 'transfer';
  raw: string;
  blockhash: string;
  lastValidBlockHeight: number;
  signature?: string;
  status: 'prepared' | 'finalized';
  slot?: number;
  verifiedAt?: string;
  evidence?: Record<string, string>;
  recipient?: string;
}
export interface State {
  version: 1;
  network: 'devnet';
  wallet: string;
  mint?: string;
  operations: Record<string, Operation>;
}

export async function readState(wallet: string): Promise<State> {
  let raw: string;
  try { raw = await readFile(STATE_PATH, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, network: 'devnet', wallet, operations: {} };
    }
    throw error;
  }
  const state = JSON.parse(raw) as State;
  if (state.version !== 1 || state.network !== 'devnet' || state.wallet !== wallet ||
      !state.operations || typeof state.operations !== 'object' || Array.isArray(state.operations)) {
    throw new Error('State is incompatible with this wallet/network or is malformed. Preserve it for review.');
  }
  return state;
}

export async function saveState(state: State): Promise<void> {
  const temporary = `${STATE_PATH}.tmp`;
  const file = await open(temporary, 'w', 0o600);
  try { await file.writeFile(JSON.stringify(state, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, STATE_PATH);
}

export async function withState(wallet: string, action: (state: State) => Promise<void>): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true, mode: 0o700 });
  const lockPath = `${STATE_DIR}/operation.lock`;
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new Error('State is locked by another run. If a process crashed, follow docs/recovery.md.'); }
  try {
    await lock.writeFile(`pid=${process.pid}\n`);
    await action(await readState(wallet));
  } finally { await lock.close(); await unlink(lockPath); }
}
