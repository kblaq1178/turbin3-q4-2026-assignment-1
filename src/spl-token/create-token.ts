import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createInitializeMint2Instruction, MINT_SIZE, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { devnetConnection } from '../lib/connection.js';
import { explorer, run } from '../lib/config.js';
import { withState } from '../lib/state.js';
import { prepare, recordEvidence, settle } from '../lib/transaction.js';
import { loadWallet } from '../wallet/load-wallet.js';
import { checkedMint, DECIMALS } from './shared.js';

await run(async () => {
  const wallet = await loadWallet();
  const connection = await devnetConnection();
  await withState(wallet.publicKey.toBase58(), async (state) => {
    if (!state.operations.create) {
      if (state.mint) throw new Error('Mint exists without creation journal. Preserve state for review.');
      const mint = Keypair.generate();
      const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      const transaction = new Transaction().add(
        SystemProgram.createAccount({ fromPubkey: wallet.publicKey, newAccountPubkey: mint.publicKey, lamports: rent, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
        createInitializeMint2Instruction(mint.publicKey, DECIMALS, wallet.publicKey, null),
      );
      state.mint = mint.publicKey.toBase58();
      await prepare(connection, state, 'create', 'create', transaction, [wallet, mint], rent);
    }
    const operation = await settle(connection, state, 'create');
    const mint = await checkedMint(connection, state);
    await recordEvidence(state, operation, { mint: mint.address.toBase58(), decimals: String(mint.decimals), supplyBaseUnits: mint.supply.toString() });
    console.log(`Mint: ${new PublicKey(state.mint!).toBase58()}`);
    console.log(explorer(mint.address.toBase58(), 'address'));
    console.log(`Transaction: ${operation.signature}`);
  });
});
