import { run, explorer } from '../lib/config.js';
import { readNftState } from './journal.js';
import { context, currentAsset, reportAsset } from './shared.js';

await run(async () => {
  const { connection, wallet, umi } = await context();
  const state = await readNftState(wallet.publicKey.toBase58());
  if (!state) throw new Error('No NFT journal; no asset has been prepared.');
  console.log('Network: verified Solana Devnet; finalized reads. Verification is read-only.');
  console.log(`Asset: ${state.asset}\n${explorer(state.asset, 'address')}`);
  let failed = false;
  for (const id of ['create', 'update'] as const) {
    const op = state.operations[id];
    if (!op) { console.log(`${id}: not prepared`); continue; }
    const status = (await connection.getSignatureStatuses([op.signature], { searchTransactionHistory: true })).value[0];
    console.log({ operation: id, journalStatus: op.status, signature: op.signature,
      liveStatus: status?.confirmationStatus ?? 'unknown / unavailable', error: status?.err ?? null,
      slot: status?.slot ?? null, firstVerifiedAt: op.verifiedAt ?? null });
    console.log(explorer(op.signature));
    if (status?.err) failed = true;
  }
  reportAsset(await currentAsset(umi, state.asset));
  if (failed) throw new Error('At least one NFT transaction failed on-chain.');
});
