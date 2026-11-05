import { isDeepStrictEqual } from 'node:util';
import { update } from '@metaplex-foundation/mpl-core';
import { run } from '../lib/config.js';
import { readNftState, recover, saveNftState, submitFresh, withNftLock } from './journal.js';
import { validatePlan } from './metadata.js';
import { assertAuthority, assertFields, context, currentAsset, evidence, prepareNft } from './shared.js';

await run(() => withNftLock(async () => {
  const { connection, wallet, umi } = await context();
  const state = await readNftState(wallet.publicKey.toBase58());
  if (!state) throw new Error('No NFT journal. Manually create the NFT first.');
  await recover(connection, state, 'create');
  if (state.operations.update) {
    await recover(connection, state, 'update');
  } else {
    const plan = await validatePlan();
    if (!isDeepStrictEqual(plan, state.plan)) throw new Error('Metadata URLs or bytes changed since creation. Preserve the recorded plan.');
    const asset = await currentAsset(umi, state.asset);
    assertAuthority(asset, wallet.publicKey.toBase58());
    assertFields(asset, state, state.plan.original);
    const builder = update(umi, { asset, authority: umi.identity, name: plan.updated.name, uri: plan.updated.uri });
    state.operations.update = await prepareNft(connection, builder, [wallet]);
    await saveNftState(state);
    await submitFresh(connection, state, 'update');
  }
  const asset = await currentAsset(umi, state.asset);
  assertFields(asset, state, state.plan.updated);
  await evidence(state, 'update', asset);
}));
