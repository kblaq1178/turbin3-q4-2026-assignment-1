import { Connection } from '@solana/web3.js';
import { DEVNET_GENESIS, rpcUrl } from './config.js';

export async function devnetConnection(): Promise<Connection> {
  const connection = new Connection(rpcUrl(), { commitment: 'finalized', confirmTransactionInitialTimeout: 60_000 });
  if (await connection.getGenesisHash() !== DEVNET_GENESIS) {
    throw new Error('RPC genesis hash does not match Devnet. Refusing to continue.');
  }
  return connection;
}
