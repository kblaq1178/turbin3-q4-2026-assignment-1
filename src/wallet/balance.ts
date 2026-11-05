import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { devnetConnection } from '../lib/connection.js';
import { explorer, run } from '../lib/config.js';
import { loadWallet } from './load-wallet.js';

await run(async () => {
  const wallet = await loadWallet();
  const connection = await devnetConnection();
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Network: devnet');
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`SOL: ${balance / LAMPORTS_PER_SOL} (${balance} lamports)`);
  console.log(explorer(wallet.publicKey.toBase58(), 'address'));
});
