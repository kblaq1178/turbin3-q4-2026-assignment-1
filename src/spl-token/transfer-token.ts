import { Transaction } from '@solana/web3.js';
import { ACCOUNT_SIZE, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { devnetConnection } from '../lib/connection.js';
import { run } from '../lib/config.js';
import { withState } from '../lib/state.js';
import { prepare, recordEvidence, settle } from '../lib/transaction.js';
import { loadWallet } from '../wallet/load-wallet.js';
import { checkedMint, DECIMALS, formatTokens, recipientAddress, tokenBalance, TRANSFER_AMOUNT, verifyTokenDelta } from './shared.js';

await run(async () => {
  const wallet = await loadWallet();
  const recipient = recipientAddress(process.argv[2], wallet.publicKey);
  if (process.argv.length !== 3) throw new Error('Expected exactly one recipient public address.');
  const connection = await devnetConnection();
  await withState(wallet.publicKey.toBase58(), async (state) => {
    const mint = await checkedMint(connection, state);
    if (!state.operations.mint?.verifiedAt) throw new Error('Run token:mint and verify initial supply first.');
    // One assignment transfer; even a different recipient cannot bypass replay protection.
    const existing = state.operations.transfer;
    if (existing?.recipient !== undefined && existing.recipient !== recipient.toBase58()) {
      throw new Error('A transfer to a different recipient is already recorded. Preserve the journal.');
    }
    if (!existing) {
      if (await tokenBalance(connection, mint.address, wallet.publicKey) < TRANSFER_AMOUNT) throw new Error('Insufficient sender token balance: need 10 tokens.');
      const source = getAssociatedTokenAddressSync(mint.address, wallet.publicKey);
      const destination = getAssociatedTokenAddressSync(mint.address, recipient);
      const rent = await connection.getAccountInfo(destination) === null ? await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE) : 0;
      const transaction = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, destination, recipient, mint.address),
        createTransferCheckedInstruction(source, mint.address, destination, wallet.publicKey, TRANSFER_AMOUNT, DECIMALS),
      );
      await prepare(connection, state, 'transfer', 'transfer', transaction, [wallet], rent, recipient.toBase58());
    }
    const operation = await settle(connection, state, 'transfer');
    await verifyTokenDelta(connection, operation.signature!, getAssociatedTokenAddressSync(mint.address, wallet.publicKey), -TRANSFER_AMOUNT);
    await verifyTokenDelta(connection, operation.signature!, getAssociatedTokenAddressSync(mint.address, recipient), TRANSFER_AMOUNT);
    const senderBalance = await tokenBalance(connection, mint.address, wallet.publicKey);
    const recipientBalance = await tokenBalance(connection, mint.address, recipient);
    await recordEvidence(state, operation, { recipient: recipient.toBase58(), transferredBaseUnits: TRANSFER_AMOUNT.toString(), senderBalance: formatTokens(senderBalance), recipientBalance: formatTokens(recipientBalance) });
  });
});
