import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { STATE_DIR } from '../lib/config.js';
import { signatureText } from '../lib/transaction.js';
import type { Plan } from './metadata.js';

export const NFT_STATE = resolve(STATE_DIR, 'mpl-core-devnet.json');
export interface NftOperation {
  raw: string; signature: string; blockhash: string; lastValidBlockHeight: number;
  status: 'prepared' | 'attempted' | 'finalized'; slot?: number;
  verifiedAt?: string; evidence?: Record<string, string>;
}
export interface NftState {
  version: 1; network: 'devnet'; wallet: string; asset: string; owner: string; updateAuthority: string;
  plan: Plan; operations: { create: NftOperation; update?: NftOperation };
}
export function validateJournal(state: NftState, wallet: string): void {
  if (state.version !== 1 || state.network !== 'devnet' || state.wallet !== wallet ||
      state.owner !== wallet || state.updateAuthority !== wallet || !state.operations?.create ||
      !state.plan?.original || !state.plan.updated) throw new Error('Incompatible NFT journal; preserve for review.');
  new PublicKey(state.asset);
  for (const op of Object.values(state.operations)) {
    if (!op || !['prepared', 'attempted', 'finalized'].includes(op.status) ||
        !Number.isSafeInteger(op.lastValidBlockHeight) || op.lastValidBlockHeight < 1) throw new Error('Malformed NFT operation.');
    const tx = Transaction.from(Buffer.from(op.raw, 'base64'));
    if (!tx.verifySignatures() || tx.feePayer?.toBase58() !== wallet ||
        tx.recentBlockhash !== op.blockhash || !tx.signature || signatureText(tx.signature) !== op.signature ||
        !tx.instructions.some(ix => ix.keys.some(k => k.pubkey.toBase58() === state.asset))) {
      throw new Error('NFT journal transaction validation failed.');
    }
  }
}
export async function readNftState(wallet: string): Promise<NftState | undefined> {
  let raw: string;
  try { raw = await readFile(NFT_STATE, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  const state = JSON.parse(raw) as NftState;
  validateJournal(state, wallet);
  return state;
}
export async function saveNftState(state: NftState): Promise<void> {
  validateJournal(state, state.wallet);
  const file = await open(`${NFT_STATE}.tmp`, 'w', 0o600);
  try { await file.writeFile(JSON.stringify(state, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(`${NFT_STATE}.tmp`, NFT_STATE);
}
export async function withNftLock(action: () => Promise<void>): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true, mode: 0o700 });
  const path = resolve(STATE_DIR, 'mpl-core-operation.lock');
  let lock;
  try { lock = await open(path, 'wx', 0o600); }
  catch { throw new Error('NFT journal locked. See docs/mpl-core.md before removing a stale lock.'); }
  try { await lock.writeFile(`pid=${process.pid}\n`); await lock.sync(); await action(); }
  finally { await lock.close(); await unlink(path); }
}

// Recovery NEVER sends. Only the same invocation that durably prepared the operation
// may call submitFresh; ambiguous sends, expiry, and failed transactions stop here.
export async function recover(
  connection: Connection, state: NftState, id: 'create' | 'update', persist = saveNftState,
): Promise<NftOperation> {
  validateJournal(state, state.wallet);
  const op = state.operations[id]; if (!op) throw new Error('Missing NFT operation.');
  const status = (await connection.getSignatureStatuses([op.signature], { searchTransactionHistory: true })).value[0];
  if (status?.err) throw new Error(`NFT transaction failed: ${JSON.stringify(status.err)}. Preserve journal for review.`);
  if (status?.confirmationStatus !== 'finalized') {
    throw new Error('NFT outcome pending or unknown. No rebroadcast or replacement. Run nft:verify; see docs/mpl-core.md.');
  }
  op.status = 'finalized'; op.slot = status.slot; await persist(state);
  return op;
}
export async function submitFresh(
  connection: Connection, state: NftState, id: 'create' | 'update', persist = saveNftState,
): Promise<NftOperation> {
  validateJournal(state, state.wallet);
  const op = state.operations[id];
  if (!op || op.status !== 'prepared') throw new Error('Only a freshly prepared NFT operation can be submitted.');
  if (await connection.getBlockHeight('finalized') > op.lastValidBlockHeight) throw new Error('NFT transaction expired. Preserve journal.');
  op.status = 'attempted'; await persist(state); // Must succeed before any send.
  console.log(`Submitting NFT transaction ${op.signature}`);
  const signature = await connection.sendRawTransaction(Buffer.from(op.raw, 'base64'), {
    skipPreflight: false, preflightCommitment: 'finalized', maxRetries: 0,
  });
  if (signature !== op.signature) throw new Error('Unexpected RPC signature; preserve journal.');
  const result = await connection.confirmTransaction({ signature, blockhash: op.blockhash,
    lastValidBlockHeight: op.lastValidBlockHeight }, 'finalized');
  if (result.value.err) throw new Error(`NFT transaction failed: ${JSON.stringify(result.value.err)}`);
  return recover(connection, state, id, persist);
}
