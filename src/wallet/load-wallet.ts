import { Keypair } from '@solana/web3.js';
import { readFile } from 'node:fs/promises';
import { WALLET_PATH } from '../lib/config.js';

export async function loadWallet(): Promise<Keypair> {
  let data: unknown;
  try { data = JSON.parse(await readFile(WALLET_PATH, 'utf8')); }
  catch { throw new Error('Cannot read local wallet. Run npm.cmd run wallet:create once, or check its file permissions.'); }
  if (!Array.isArray(data) || data.length !== 64 ||
      !data.every((byte: unknown) => typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    throw new Error('Invalid wallet file: expected a 64-byte Solana keypair array.');
  }
  try { return Keypair.fromSecretKey(Uint8Array.from(data as number[])); }
  catch { throw new Error('Wallet keypair validation failed.'); }
}
