import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { create, update, getCreateV2InstructionDataSerializer, getUpdateV2InstructionDataSerializer,
  MPL_CORE_PROGRAM_ID, type AssetV1 } from '@metaplex-foundation/mpl-core';
import { ROOT } from '../src/lib/config.js';
import { signatureText } from '../src/lib/transaction.js';
import { download, httpsUrl, metadata, validatePlan, type Target } from '../src/mpl-core/metadata.js';
import { recover, submitFresh, validateJournal, type NftState } from '../src/mpl-core/journal.js';
import { assertAuthority, assertFields, prepareNft, umiForWallet } from '../src/mpl-core/shared.js';

// Public deterministic fixtures only. No wallet reads, disk writes, or live RPC calls.
const wallet = Keypair.fromSeed(new Uint8Array(32).fill(21));
const assetKey = Keypair.fromSeed(new Uint8Array(32).fill(22));
const umi = umiForWallet(wallet);
const assetSigner = createSignerFromKeypair(umi, fromWeb3JsKeypair(assetKey));
const uri = 'https://arweave.net/' + 'a'.repeat(43);
const updatedUri = 'https://arweave.net/' + 'b'.repeat(43);
const target: Target = { name: 'Original', uri, image: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Gull_portrait_ca_usa.jpg',
  metadataSha256: 'a'.repeat(64), imageSha256: 'b'.repeat(64) };
function createBuilder() { return create(umi, { asset: assetSigner, owner: umi.identity.publicKey,
  updateAuthority: umi.identity.publicKey, name: target.name, uri: target.uri }); }
function journal(): NftState {
  const tx = new Transaction({ feePayer: wallet.publicKey, recentBlockhash: PublicKey.default.toBase58() })
    .add(...createBuilder().getInstructions().map(toWeb3JsInstruction));
  tx.sign(wallet, assetKey);
  return { version: 1, network: 'devnet', wallet: wallet.publicKey.toBase58(), asset: assetKey.publicKey.toBase58(),
    owner: wallet.publicKey.toBase58(), updateAuthority: wallet.publicKey.toBase58(),
    plan: { original: target, updated: { ...target, name: 'Updated', uri: updatedUri } }, operations: {
      create: { raw: tx.serialize().toString('base64'), signature: signatureText(tx.signature!),
        blockhash: tx.recentBlockhash!, lastValidBlockHeight: 100, status: 'prepared' },
    } };
}
function chainAsset(state = journal()): AssetV1 {
  return { publicKey: assetSigner.publicKey, owner: umi.identity.publicKey,
    updateAuthority: { type: 'Address', address: umi.identity.publicKey }, name: state.plan.original.name,
    uri: state.plan.original.uri } as AssetV1;
}
const noDisk = async (_state: NftState): Promise<void> => {};
function rpc(state: NftState, status: unknown = null) {
  let sends = 0;
  return { connection: {
    getSignatureStatuses: async () => ({ value: [status] }), getBlockHeight: async () => 50,
    sendRawTransaction: async (raw: Buffer) => { sends++; assert.equal(raw.toString('base64'), state.operations.create.raw); return state.operations.create.signature; },
    confirmTransaction: async () => ({ value: { err: null } }),
  } as unknown as Connection, sends: () => sends };
}

test('documented Web3 keypair conversion signs with the existing public identity', async () => {
  assert.equal(umi.identity.publicKey, wallet.publicKey.toBase58());
  const message = new Uint8Array([1,2,3]);
  assert.equal(await umi.eddsa.verify(message, await umi.identity.signMessage(message), umi.identity.publicKey), true);
});
test('Core 1.10 create builds a standalone asset with explicit owner and update authority', () => {
  const ix = createBuilder().getInstructions()[0]!;
  assert.equal(ix.programId, MPL_CORE_PROGRAM_ID);
  const [decoded] = getCreateV2InstructionDataSerializer().deserialize(ix.data);
  assert.equal(decoded.name, target.name); assert.equal(decoded.uri, target.uri);
  assert.equal(ix.keys[0]!.pubkey, assetSigner.publicKey);
  assert.ok(ix.keys.some(k => k.pubkey === umi.identity.publicKey));
  validateJournal(journal(), wallet.publicKey.toBase58());
});
test('Core 1.10 update encodes both new name and URI with wallet authority', () => {
  const ix = update(umi, { asset: chainAsset(), authority: umi.identity, name: 'Updated', uri: updatedUri }).getInstructions()[0]!;
  const [decoded] = getUpdateV2InstructionDataSerializer().deserialize(ix.data);
  assert.deepEqual(decoded.newName, { __option: 'Some', value: 'Updated' });
  assert.deepEqual(decoded.newUri, { __option: 'Some', value: updatedUri });
});
test('authority and on-chain verification reject mismatches', () => {
  const state = journal(); const asset = chainAsset(state);
  assertAuthority(asset, state.wallet); assertFields(asset, state, target);
  assert.throws(() => assertAuthority({ updateAuthority: { type: 'None' } }, state.wallet));
  assert.throws(() => assertAuthority({ updateAuthority: { type: 'Collection', address: umi.identity.publicKey } }, state.wallet));
  assert.throws(() => assertAuthority(asset, assetSigner.publicKey));
  assert.throws(() => assertFields({ ...asset, uri: updatedUri }, state, target));
  assert.throws(() => assertFields({ ...asset, name: 'Wrong' }, state, target));
  assert.throws(() => assertFields({ ...asset, owner: assetSigner.publicKey }, state, target));
});
test('prepare simulates exactly the signed bytes, without sending', async () => {
  let simulated = false;
  const connection = {
    getLatestBlockhash: async () => ({ blockhash: PublicKey.default.toBase58(), lastValidBlockHeight: 100 }),
    getFeeForMessage: async () => ({ value: 5000 }), getMinimumBalanceForRentExemption: async () => 1000,
    getBalance: async () => 10_000_000,
    simulateTransaction: async (tx: VersionedTransaction, config: { sigVerify: boolean }) => {
      simulated = true; assert.equal(config.sigVerify, true);
      const decoded = Transaction.from(tx.serialize()); assert.ok(decoded.verifySignatures());
      return { value: { err: null } };
    },
  } as unknown as Connection;
  const op = await prepareNft(connection, createBuilder(), [wallet, assetKey]);
  assert.ok(simulated); assert.equal(op.raw, journal().operations.create.raw);
});
test('recovery accepts finalized status without sending', async () => {
  const state = journal(); const fake = rpc(state, { err: null, confirmationStatus: 'finalized', slot: 42 });
  await recover(fake.connection, state, 'create', noDisk);
  assert.equal(state.operations.create.slot, 42); assert.equal(fake.sends(), 0);
});
for (const [label, status] of [
  ['unknown', null], ['confirmed', { err: null, confirmationStatus: 'confirmed' }],
  ['failed', { err: { InstructionError: [0, 'Custom'] }, confirmationStatus: 'finalized' }],
] as const) {
  test(`${label} recovery never sends or replaces the transaction`, async () => {
    const state = journal(); const fake = rpc(state, status);
    await assert.rejects(recover(fake.connection, state, 'create', noDisk));
    assert.equal(fake.sends(), 0);
  });
}
test('missing history after finalization never rebroadcasts', async () => {
  const state = journal(); state.operations.create.status = 'finalized'; const fake = rpc(state);
  await assert.rejects(recover(fake.connection, state, 'create', noDisk)); assert.equal(fake.sends(), 0);
});
test('failed durable save prevents broadcast', async () => {
  const state = journal(); const fake = rpc(state);
  await assert.rejects(submitFresh(fake.connection, state, 'create', async () => { throw new Error('disk failed'); }), /disk failed/);
  assert.equal(fake.sends(), 0);
});
test('lost send response leaves attempted state and recovery never resends', async () => {
  const state = journal(); const fake = rpc(state);
  fake.connection.sendRawTransaction = async () => { throw new Error('response lost'); };
  await assert.rejects(submitFresh(fake.connection, state, 'create', noDisk), /response lost/);
  assert.equal(state.operations.create.status, 'attempted');
  await assert.rejects(recover(fake.connection, state, 'create', noDisk)); assert.equal(fake.sends(), 0);
});
test('journal tampering and wallet mismatch are blocked', () => {
  const state = journal(); assert.throws(() => validateJournal(state, assetKey.publicKey.toBase58()));
  state.operations.create.signature = 'invalid'; assert.throws(() => validateJournal(state, state.wallet));
});
test('URL and metadata guards reject placeholders, local files, HTTP and malformed attributes', () => {
  for (const url of ['http://arweave.net/a', 'https://example.com/a', 'file:///image.png', 'https://localhost/a', 'https://127.0.0.1/a']) assert.throws(() => httpsUrl(url));
  assert.throws(() => metadata({ name: 'X', description: 'D', image: target.image, attributes: [{}] }));
  assert.throws(() => metadata({ name: 'x'.repeat(33), description: 'D', image: target.image, attributes: [] }));
});
test('public GET rejects HTML, error responses and fake image bytes', async () => {
  await assert.rejects(download(uri, 'json', async () => new Response('<html/>', { headers: { 'content-type': 'text/html' } })));
  await assert.rejects(download(uri, 'json', async () => new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } })));
  await assert.rejects(download(target.image, 'image', async () => new Response('not a jpeg', { headers: { 'content-type': 'image/jpeg' } })));
});
test('both local metadata files and all four public GETs are required before minting', async () => {
  const previous = [process.env.NFT_ORIGINAL_URI, process.env.NFT_UPDATED_URI];
  try {
    process.env.NFT_ORIGINAL_URI = uri; process.env.NFT_UPDATED_URI = updatedUri;
    let calls = 0;
    const fakeFetch: typeof fetch = async input => {
      calls++;
      if (String(input) === uri || String(input) === updatedUri) {
        const file = String(input) === uri ? 'original.json' : 'updated.json';
        return new Response(await readFile(resolve(ROOT, 'metadata', file), 'utf8'), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(new Uint8Array([255,216,255,1]), { headers: { 'content-type': 'image/jpeg' } });
    };
    const plan = await validatePlan(fakeFetch); assert.equal(calls, 4);
    assert.notEqual(plan.original.name, plan.updated.name);
    await assert.rejects(validatePlan(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })));
  } finally {
    if (previous[0] === undefined) delete process.env.NFT_ORIGINAL_URI; else process.env.NFT_ORIGINAL_URI = previous[0];
    if (previous[1] === undefined) delete process.env.NFT_UPDATED_URI; else process.env.NFT_UPDATED_URI = previous[1];
  }
});
