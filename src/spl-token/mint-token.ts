import { Transaction } from '@solana/web3.js';
import { ACCOUNT_SIZE, createAssociatedTokenAccountIdempotentInstruction, createMintToCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { devnetConnection } from '../lib/connection.js';
import { run } from '../lib/config.js';
import { withState } from '../lib/state.js';
import { prepare, recordEvidence, settle } from '../lib/transaction.js';
import { loadWallet } from '../wallet/load-wallet.js';
import { checkedMint, DECIMALS, formatTokens, MINT_AMOUNT, tokenBalance, verifyTokenDelta } from './shared.js';

await run(async () => {
  const wallet = await loadWallet();
  const connection = await devnetConnection();
  await withState(wallet.publicKey.toBase58(), async (state) => {
    const mint = await checkedMint(connection, state);
    if (state.operations.create?.status !== 'finalized') throw new Error('Run token:create to confirm creation first.');
    if (!state.operations.mint) {
      if (mint.supply !== 0n || await tokenBalance(connection, mint.address, wallet.publicKey) !== 0n) {
        throw new Error('Mint already has supply or owner balance. Refusing additional minting.');
      }
      const ata = getAssociatedTokenAddressSync(mint.address, wallet.publicKey);
      const rent = await connection.getAccountInfo(ata) === null ? await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE) : 0;
      const transaction = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, wallet.publicKey, mint.address),
        createMintToCheckedInstruction(mint.address, ata, wallet.publicKey, MINT_AMOUNT, DECIMALS),
      );
      await prepare(connection, state, 'mint', 'mint', transaction, [wallet], rent);
    }
    const operation = await settle(connection, state, 'mint');
    const updatedMint = await checkedMint(connection, state);
    const balance = await tokenBalance(connection, mint.address, wallet.publicKey);
    if (updatedMint.supply !== MINT_AMOUNT) throw new Error('Supply verification failed: expected exactly 1,000 tokens.');
    // Historical transaction deltas remain valid after later transfers.
    await verifyTokenDelta(connection, operation.signature!, getAssociatedTokenAddressSync(mint.address, wallet.publicKey), MINT_AMOUNT);
    await recordEvidence(state, operation, { supply: formatTokens(updatedMint.supply), senderBalance: formatTokens(balance), mintedBaseUnits: MINT_AMOUNT.toString() });
  });
});
