import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { explorer } from './config.js';
import { saveState, type Operation, type State } from './state.js';

// Solana signatures are base58 encoded; keep this dependency-free.
export function signatureText(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
  let result = '';
  while (value > 0n) { result = alphabet[Number(value % 58n)]! + result; value /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}

export async function prepare(
  connection: Connection, state: State, id: string, kind: Operation['kind'],
  transaction: Transaction, signers: Keypair[], rent: number, recipient?: string,
): Promise<void> {
  if (state.operations[id]) throw new Error('Operation already exists. Resume it instead.');
  const payer = signers[0];
  if (!payer) throw new Error('Missing fee payer.');
  const latest = await connection.getLatestBlockhash('finalized');
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  const fee = (await connection.getFeeForMessage(transaction.compileMessage(), 'finalized')).value;
  if (fee === null) throw new Error('RPC could not estimate the transaction fee. Retry later.');
  if (await connection.getBalance(payer.publicKey) < rent + fee) {
    throw new Error(`Insufficient Devnet SOL: need at least ${rent + fee} lamports for rent and fee. Fund from Phantom on Devnet.`);
  }
  transaction.sign(...signers);
  if (!transaction.signature) throw new Error('Missing transaction signature.');
  const operation: Operation = {
    kind, raw: transaction.serialize().toString('base64'), ...latest, status: 'prepared',
    signature: signatureText(transaction.signature),
  };
  if (recipient) operation.recipient = recipient;
  state.operations[id] = operation;
  // Persist BEFORE broadcast. This journal has signed bytes, never private keys.
  await saveState(state);
}

export async function settle(connection: Connection, state: State, id: string, persist = saveState): Promise<Operation> {
  const operation = state.operations[id];
  if (!operation) throw new Error('Missing prepared operation.');
  const raw = Buffer.from(operation.raw, 'base64');
  const transaction = Transaction.from(raw);
  if (!transaction.verifySignatures() || transaction.feePayer?.toBase58() !== state.wallet ||
      transaction.recentBlockhash !== operation.blockhash || !transaction.signature ||
      signatureText(transaction.signature) !== operation.signature) throw new Error('Transaction journal validation failed.');
  // sendRawTransaction returns the signature. If a response was lost, replaying the
  // identical signed bytes uses the identical signature and cannot execute twice.
  if (operation.signature) {
    const status = (await connection.getSignatureStatuses([operation.signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}. See docs/recovery.md.`);
    if (status?.confirmationStatus === 'finalized') {
      operation.status = 'finalized'; operation.slot = status.slot;
      await persist(state);
      return operation;
    }
  }
  if (operation.status === 'finalized') throw new Error('Finalized transaction history unavailable. Preserve state; retry verification later.');
  if (await connection.getBlockHeight('finalized') > operation.lastValidBlockHeight) {
    throw new Error('Prepared transaction expired or its outcome is uncertain. No replacement will be sent. See docs/recovery.md.');
  }
  const returnedSignature = await connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: 'finalized', maxRetries: 3 });
  if (returnedSignature !== operation.signature) throw new Error('RPC returned an unexpected transaction signature.');
  await persist(state);
  console.log(`Transaction: ${operation.signature}`);
  console.log(explorer(operation.signature));
  const confirmation = await connection.confirmTransaction({
    signature: operation.signature, blockhash: operation.blockhash,
    lastValidBlockHeight: operation.lastValidBlockHeight,
  }, 'finalized');
  if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  operation.status = 'finalized'; operation.slot = confirmation.context.slot;
  await persist(state);
  return operation;
}

export async function recordEvidence(state: State, operation: Operation, evidence: Record<string, string>): Promise<void> {
  if (!operation.verifiedAt) {
    operation.evidence = evidence;
    operation.verifiedAt = new Date().toISOString();
    await saveState(state);
  }
  console.log(evidence);
  if (operation.signature) console.log(explorer(operation.signature));
}
