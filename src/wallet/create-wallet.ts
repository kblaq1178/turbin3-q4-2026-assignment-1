import { Keypair } from '@solana/web3.js';
import { mkdir, open, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { WALLET_PATH, rpcUrl, run } from '../lib/config.js';

await run(async () => {
  rpcUrl();
  await mkdir(dirname(WALLET_PATH), { recursive: true, mode: 0o700 });
  // Exclusive creation prevents replacing an existing wallet, even under concurrency.
  const file = await open(WALLET_PATH, 'wx', 0o600);
  let secured = false;
  try {
    if (process.platform === 'win32') {
      const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' });
      const sid = identity.match(/S-1-\d+(?:-\d+)+/)?.[0];
      if (!sid) throw new Error('Unable to identify Windows user for wallet ACL.');
      // The new file is still empty while inherited access is removed.
      execFileSync('icacls.exe', [WALLET_PATH, '/inheritance:r', '/grant:r', `*${sid}:F`], { stdio: 'pipe' });
    } else {
      await file.chmod(0o600);
    }
    secured = true;
    const wallet = Keypair.generate();
    await file.writeFile(JSON.stringify(Array.from(wallet.secretKey)) + '\n');
    await file.sync();
    console.log(wallet.publicKey.toBase58());
  } finally {
    await file.close();
    if (!secured) await unlink(WALLET_PATH);
    // A write failure preserves the file for manual inspection; never overwrite it.
  }
});
