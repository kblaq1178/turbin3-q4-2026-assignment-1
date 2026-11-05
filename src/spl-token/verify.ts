import { devnetConnection } from '../lib/connection.js';
import { explorer, run } from '../lib/config.js';
import { readState } from '../lib/state.js';
import { loadWallet } from '../wallet/load-wallet.js';
import { checkedMint, formatTokens, recipientAddress, tokenBalance } from './shared.js';

await run(async () => {
  if (process.argv.length > 3) throw new Error('Expected at most one recipient public address.');
  const wallet = await loadWallet();
  const state = await readState(wallet.publicKey.toBase58());
  const connection = await devnetConnection();
  const mint = await checkedMint(connection, state);
  console.log('Network: devnet (genesis hash verified, finalized commitment)');
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Mint: ${mint.address.toBase58()}`);
  console.log(`Decimals: ${mint.decimals}`);
  console.log(`Total supply: ${formatTokens(mint.supply)} (${mint.supply} base units)`);
  console.log(`Sender ATA balance: ${formatTokens(await tokenBalance(connection, mint.address, wallet.publicKey))}`);
  const supplied = process.argv[2] ?? state.operations.transfer?.recipient;
  if (supplied) {
    const recipient = recipientAddress(supplied, wallet.publicKey);
    console.log(`Recipient: ${recipient.toBase58()}`);
    console.log(`Recipient ATA balance: ${formatTokens(await tokenBalance(connection, mint.address, recipient))}`);
  }
  console.log(explorer(mint.address.toBase58(), 'address'));
  for (const [id, operation] of Object.entries(state.operations)) {
    console.log(`${id}: ${operation.status}, verified: ${operation.verifiedAt ?? 'pending'}`);
    if (operation.signature) {
      const status = (await connection.getSignatureStatuses([operation.signature], { searchTransactionHistory: true })).value[0];
      console.log(`RPC transaction status: ${status ? JSON.stringify(status) : 'unavailable; inspect Explorer / history'}`);
      console.log(explorer(operation.signature));
      if (status?.err) throw new Error(`${id} transaction failed on-chain.`);
    }
  }
});
