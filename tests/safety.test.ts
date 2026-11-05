import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { rpcUrl } from '../src/lib/config.js';
import { settle, signatureText } from '../src/lib/transaction.js';
import type { State } from '../src/lib/state.js';
import { formatTokens, MINT_AMOUNT, recipientAddress, TRANSFER_AMOUNT } from '../src/spl-token/shared.js';

// Public, deterministic test fixtures only. No development wallet is generated,
// no keypair file is written, and every RPC method below is an in-memory fake.
const fixture = Keypair.fromSeed(new Uint8Array(32).fill(7));
const recipient = Keypair.fromSeed(new Uint8Array(32).fill(8)).publicKey;

test('token amounts retain exact nine-decimal precision', () => {
  assert.equal(MINT_AMOUNT, 1_000_000_000_000n);
  assert.equal(TRANSFER_AMOUNT, 10_000_000_000n);
  assert.equal(formatTokens(MINT_AMOUNT), '1000');
  assert.equal(formatTokens(1n), '0.000000001');
  assert.equal(formatTokens(1_230_000_000n), '1.23');
});

test('recipient validation rejects absent, invalid, self and off-curve addresses', () => {
  assert.throws(() => recipientAddress(undefined, fixture.publicKey));
  assert.throws(() => recipientAddress('invalid', fixture.publicKey));
  assert.throws(() => recipientAddress(fixture.publicKey.toBase58(), fixture.publicKey));
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('fixture')], SystemProgram.programId);
  assert.throws(() => recipientAddress(pda.toBase58(), fixture.publicKey));
  assert.ok(recipientAddress(recipient.toBase58(), fixture.publicKey).equals(recipient));
});

test('configuration rejects mainnet and alternate RPC URLs', () => {
  const network = process.env.SOLANA_NETWORK;
  const url = process.env.SOLANA_RPC_URL;
  try {
    process.env.SOLANA_NETWORK = 'mainnet-beta';
    assert.throws(rpcUrl);
    process.env.SOLANA_NETWORK = 'devnet';
    process.env.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
    assert.throws(rpcUrl);
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
    assert.equal(rpcUrl(), process.env.SOLANA_RPC_URL);
  } finally {
    if (network === undefined) delete process.env.SOLANA_NETWORK; else process.env.SOLANA_NETWORK = network;
    if (url === undefined) delete process.env.SOLANA_RPC_URL; else process.env.SOLANA_RPC_URL = url;
  }
});

test('base58 encoding matches PublicKey encoding, including leading zeroes', () => {
  assert.equal(signatureText(fixture.publicKey.toBytes()), fixture.publicKey.toBase58());
  assert.equal(signatureText(new Uint8Array(32)), SystemProgram.programId.toBase58());
  assert.equal(signatureText(Uint8Array.from([0, 0, 58])), '1121');
});

function journal(): State {
  const transaction = new Transaction({ feePayer: fixture.publicKey, recentBlockhash: SystemProgram.programId.toBase58() })
    .add(SystemProgram.transfer({ fromPubkey: fixture.publicKey, toPubkey: recipient, lamports: 1 }));
  transaction.sign(fixture);
  return { version: 1, network: 'devnet', wallet: fixture.publicKey.toBase58(), operations: {
    transfer: { kind: 'transfer', raw: transaction.serialize().toString('base64'),
      signature: signatureText(transaction.signature!), blockhash: transaction.recentBlockhash!,
      lastValidBlockHeight: 100, status: 'prepared' },
  } };
}

function fakeRpc(state: State, status: unknown = null, height = 50) {
  let sends = 0;
  const rpc = {
    getSignatureStatuses: async () => ({ value: [status] }),
    getBlockHeight: async () => height,
    sendRawTransaction: async (raw: Buffer) => {
      sends++;
      assert.equal(raw.toString('base64'), state.operations.transfer!.raw);
      return state.operations.transfer!.signature;
    },
    confirmTransaction: async () => ({ context: { slot: 55 }, value: { err: null } }),
  };
  return { connection: rpc as unknown as Connection, sends: () => sends };
}
const noDisk = async (_state: State): Promise<void> => {};

test('expired transaction is blocked without replacement or broadcast', async () => {
  const state = journal(); const rpc = fakeRpc(state, null, 101);
  await assert.rejects(settle(rpc.connection, state, 'transfer', noDisk), /expired/);
  assert.equal(rpc.sends(), 0);
});

test('already finalized transaction recovers without broadcast', async () => {
  const state = journal(); const rpc = fakeRpc(state, { err: null, confirmationStatus: 'finalized', slot: 44 }, 101);
  await settle(rpc.connection, state, 'transfer', noDisk);
  assert.equal(state.operations.transfer!.status, 'finalized');
  assert.equal(state.operations.transfer!.slot, 44);
  assert.equal(rpc.sends(), 0);
});

test('finalized journal with missing history never rebroadcasts', async () => {
  const state = journal(); state.operations.transfer!.status = 'finalized';
  const rpc = fakeRpc(state);
  await assert.rejects(settle(rpc.connection, state, 'transfer', noDisk), /history unavailable/);
  assert.equal(rpc.sends(), 0);
});

test('on-chain failure is blocked without replacement', async () => {
  const state = journal(); const rpc = fakeRpc(state, { err: { InstructionError: [0, 'Custom'] } });
  await assert.rejects(settle(rpc.connection, state, 'transfer', noDisk), /failed on-chain/);
  assert.equal(rpc.sends(), 0);
});

test('resuming a pending transaction sends identical bytes and preserves signature', async () => {
  const state = journal(); const signature = state.operations.transfer!.signature;
  const rpc = fakeRpc(state);
  await settle(rpc.connection, state, 'transfer', noDisk);
  assert.equal(rpc.sends(), 1);
  assert.equal(state.operations.transfer!.signature, signature);
  assert.equal(state.operations.transfer!.status, 'finalized');
});

test('journal signature tampering is rejected before any broadcast', async () => {
  const state = journal(); state.operations.transfer!.signature = 'invalid';
  const rpc = fakeRpc(state);
  await assert.rejects(settle(rpc.connection, state, 'transfer', noDisk), /validation failed/);
  assert.equal(rpc.sends(), 0);
});
