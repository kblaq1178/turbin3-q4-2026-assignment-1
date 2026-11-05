import { PublicKey, type Connection } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddressSync, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { State } from '../lib/state.js';

export const DECIMALS = 9;
export const SCALE = 10n ** BigInt(DECIMALS);
export const MINT_AMOUNT = 1_000n * SCALE;
export const TRANSFER_AMOUNT = 10n * SCALE;

export function formatTokens(amount: bigint): string {
  const fraction = (amount % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return `${amount / SCALE}${fraction ? `.${fraction}` : ''}`;
}

export function recipientAddress(value: string | undefined, sender: PublicKey): PublicKey {
  if (!value) throw new Error('Supply a recipient: npm.cmd run token:transfer -- <PUBLIC_ADDRESS>');
  let address: PublicKey;
  try { address = new PublicKey(value); }
  catch { throw new Error('Invalid recipient public address.'); }
  if (!PublicKey.isOnCurve(address.toBytes())) throw new Error('Recipient must be an on-curve wallet address.');
  if (address.equals(sender)) throw new Error('Recipient must differ from the sender wallet.');
  return address;
}

export async function checkedMint(connection: Connection, state: State) {
  if (!state.mint) throw new Error('No token mint recorded. Run token:create first.');
  const mint = await getMint(connection, new PublicKey(state.mint), 'finalized', TOKEN_PROGRAM_ID);
  if (mint.decimals !== DECIMALS || mint.mintAuthority?.toBase58() !== state.wallet || mint.freezeAuthority !== null) {
    throw new Error('Mint decimals or authorities do not match this assignment.');
  }
  return mint;
}

export async function tokenBalance(connection: Connection, mint: PublicKey, owner: PublicKey): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  // Only absence means zero. RPC failures and invalid accounts must propagate.
  if (await connection.getAccountInfo(ata, 'finalized') === null) return 0n;
  const account = await getAccount(connection, ata, 'finalized', TOKEN_PROGRAM_ID);
  if (!account.owner.equals(owner) || !account.mint.equals(mint)) throw new Error('Associated token account mismatch.');
  return account.amount;
}

export async function verifyTokenDelta(connection: Connection, signature: string, ata: PublicKey, expected: bigint): Promise<void> {
  const transaction = await connection.getTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!transaction?.meta || transaction.meta.err) throw new Error('Finalized transaction metadata unavailable or failed. Retry this command later.');
  const keys = transaction.transaction.message.getAccountKeys();
  let index = -1;
  for (let i = 0; i < keys.length; i++) { if (keys.get(i)?.equals(ata)) index = i; }
  if (index < 0) throw new Error('Token account missing from transaction.');
  const pre = transaction.meta.preTokenBalances?.find((balance) => balance.accountIndex === index);
  const post = transaction.meta.postTokenBalances?.find((balance) => balance.accountIndex === index);
  if (!post || BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? '0') !== expected) {
    throw new Error('Transaction token balance delta verification failed.');
  }
}
