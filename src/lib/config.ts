import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
config({ path: resolve(ROOT, '.env'), quiet: true });
export const WALLET_PATH = resolve(ROOT, 'wallets/devnet-wallet.json');
export const STATE_DIR = resolve(ROOT, '.state');
export const STATE_PATH = resolve(STATE_DIR, 'devnet.json');
export const DEVNET_URL = 'https://api.devnet.solana.com';
export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

export function rpcUrl(): string {
  if ((process.env.SOLANA_NETWORK ?? 'devnet') !== 'devnet' ||
      (process.env.SOLANA_RPC_URL ?? DEVNET_URL) !== DEVNET_URL) {
    throw new Error('Only Solana Devnet at https://api.devnet.solana.com is permitted.');
  }
  return DEVNET_URL;
}

export const explorer = (value: string, kind: 'tx' | 'address' = 'tx'): string =>
  `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;

export async function run(main: () => Promise<void>): Promise<void> {
  try { await main(); }
  catch (error) {
    // Never dump objects, environment variables, signed bytes, or key material.
    const message = error instanceof Error ? error.message : 'Unknown failure';
    console.error(`Error: ${message}`);
    console.error('If a transaction was prepared, retain .state/ and rerun the same command. See docs/recovery.md.');
    process.exitCode = 1;
  }
}
