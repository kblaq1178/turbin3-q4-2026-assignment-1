import { Keypair } from '@solana/web3.js';
import { createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { create } from '@metaplex-foundation/mpl-core';
import { run } from '../lib/config.js';
import { readNftState, recover, saveNftState, submitFresh, withNftLock, type NftState } from './journal.js';
import { validatePlan } from './metadata.js';
import { assertAbsent, assertFields, context, currentAsset, evidence, prepareNft } from './shared.js';

await run(() => withNftLock(async () => {
  const { connection, wallet, umi } = await context();
  const address = wallet.publicKey.toBase58();
  let state = await readNftState(address);
  if (state) {
    await recover(connection, state, 'create');
    const asset = await currentAsset(umi, state.asset);
    const target = state.operations.update?.status === 'finalized' ? state.plan.updated : state.plan.original;
    assertFields(asset, state, target);
    await evidence(state, 'create', asset);
    console.log('Existing NFT verified. No new asset created.');
    return;
  }
  const plan = await validatePlan(); // BOTH JSON URLs and BOTH image GETs must pass.
  const assetKey = Keypair.generate();
  await assertAbsent(connection, assetKey.publicKey.toBase58());
  const asset = createSignerFromKeypair(umi, fromWeb3JsKeypair(assetKey));
  const builder = create(umi, { asset, owner: umi.identity.publicKey, updateAuthority: umi.identity.publicKey,
    name: plan.original.name, uri: plan.original.uri });
  const operation = await prepareNft(connection, builder, [wallet, assetKey]);
  state = { version: 1, network: 'devnet', wallet: address, asset: asset.publicKey,
    owner: address, updateAuthority: address, plan, operations: { create: operation } } satisfies NftState;
  await saveNftState(state); // Signed asset creation bytes persisted; asset secret is never stored.
  await submitFresh(connection, state, 'create');
  const onChain = await currentAsset(umi, state.asset);
  assertFields(onChain, state, plan.original);
  await evidence(state, 'create', onChain);
}));
