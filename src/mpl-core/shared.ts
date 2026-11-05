import { createSignerFromKeypair, signerIdentity, type TransactionBuilder } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { fetchAsset, mplCore, MPL_CORE_PROGRAM_ID, type AssetV1 } from '@metaplex-foundation/mpl-core';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { devnetConnection } from '../lib/connection.js';
import { DEVNET_GENESIS, rpcUrl, explorer } from '../lib/config.js';
import { signatureText } from '../lib/transaction.js';
import { loadWallet } from '../wallet/load-wallet.js';
import { saveNftState, type NftOperation, type NftState } from './journal.js';
import type { Target } from './metadata.js';

export function umiForWallet(wallet: Keypair) {
  const umi = createUmi(rpcUrl(), { commitment: 'finalized' }).use(mplCore());
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(wallet));
  umi.use(signerIdentity(signer));
  return umi;
}
export async function context() {
  const connection = await devnetConnection();
  const wallet = await loadWallet();
  const umi = umiForWallet(wallet);
  if (await umi.rpc.getGenesisHash() !== DEVNET_GENESIS) throw new Error('Umi RPC is not verified Devnet.');
  return { connection, wallet, umi };
}
export async function prepareNft(connection: Connection, builder: TransactionBuilder, signers: Keypair[]): Promise<NftOperation> {
  const latest = await connection.getLatestBlockhash('finalized');
  const payer = signers[0]; if (!payer) throw new Error('Missing payer.');
  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: latest.blockhash });
  tx.add(...builder.getInstructions().map(toWeb3JsInstruction));
  const fee = (await connection.getFeeForMessage(tx.compileMessage(), 'finalized')).value;
  const rent = await connection.getMinimumBalanceForRentExemption(builder.getBytesCreatedOnChain());
  if (fee === null || await connection.getBalance(payer.publicKey, 'finalized') < fee + rent) {
    throw new Error('Insufficient Devnet SOL or fee estimate unavailable.');
  }
  tx.sign(...signers);
  // Simulation only. Preflight is also enabled for the subsequent manual submission.
  const simulation = await connection.simulateTransaction(VersionedTransaction.deserialize(tx.serialize()), {
    commitment: 'finalized', sigVerify: true,
  });
  if (simulation.value.err) throw new Error(`NFT simulation failed: ${JSON.stringify(simulation.value.err)}`);
  if (!tx.signature) throw new Error('Missing signature.');
  return { ...latest, raw: tx.serialize().toString('base64'), signature: signatureText(tx.signature), status: 'prepared' };
}
export async function currentAsset(umi: ReturnType<typeof umiForWallet>, address: string): Promise<AssetV1> {
  const asset = await fetchAsset(umi, address, { commitment: 'finalized', skipDerivePlugins: true });
  if (asset.header.owner !== MPL_CORE_PROGRAM_ID) throw new Error('Asset is not owned by the Core program.');
  return asset;
}
export function assertAuthority(asset: Pick<AssetV1, 'updateAuthority'>, wallet: string): void {
  if (asset.updateAuthority.type !== 'Address' || asset.updateAuthority.address !== wallet) {
    throw new Error('Local wallet is not the standalone asset update authority.');
  }
}
export function assertFields(asset: AssetV1, state: NftState, target: Target): void {
  assertAuthority(asset, state.updateAuthority);
  if (asset.publicKey !== state.asset || asset.owner !== state.owner || asset.name !== target.name || asset.uri !== target.uri) {
    throw new Error('On-chain NFT address, owner, name, or URI differs from the expected journal fields.');
  }
}
export function reportAsset(asset: AssetV1): Record<string, string> {
  const result = { asset: asset.publicKey, owner: asset.owner,
    updateAuthority: `${asset.updateAuthority.type}:${asset.updateAuthority.address ?? 'none'}`,
    name: asset.name, uri: asset.uri };
  console.log(result);
  console.log(explorer(asset.publicKey, 'address'));
  console.log(`Owner: ${explorer(asset.owner, 'address')}`);
  if (asset.updateAuthority.address) console.log(`Update authority: ${explorer(asset.updateAuthority.address, 'address')}`);
  return result;
}
export async function evidence(state: NftState, id: 'create' | 'update', asset: AssetV1): Promise<void> {
  const op = state.operations[id]; if (!op) throw new Error('Missing operation.');
  const current = reportAsset(asset);
  if (!op.verifiedAt) { op.verifiedAt = new Date().toISOString(); op.evidence = current; await saveNftState(state); }
  console.log(explorer(op.signature));
}
export async function assertAbsent(connection: Connection, address: string): Promise<void> {
  if (await connection.getAccountInfo(new PublicKey(address), 'finalized')) throw new Error('Asset address already exists; refusing to create.');
}
