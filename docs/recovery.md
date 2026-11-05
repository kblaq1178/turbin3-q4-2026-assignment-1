# Transaction recovery

Every transaction has a durable journal entry before the first submission. Each entry contains its base58 signature, signed bytes, blockhash, expiry height, kind, and eventual confirmation/evidence. Never regenerate a wallet or delete `.state/devnet.json` to address a timeout.

## Normal rerun

Run the same command with the same recipient after an RPC error. It checks the saved signature with transaction history enabled. A successful finalized transaction is reused, and account verification runs again. A pending transaction may be resubmitted as identical bytes while its blockhash is valid. Identical bytes produce the same signature and cannot perform a second successful transfer or mint.

If the RPC has not yet indexed finalized transaction metadata, wait and run the same command again. Separate verification can report public balances without broadcasting:

```powershell
npm.cmd run token:verify
```

## Stale lock

If a process crashes, `.state/operation.lock` can remain. Inspect its `pid` and confirm that process is no longer running and that no other terminal is executing a token script. Only after confirming this, remove that one lock file:

```powershell
Get-Content .state/operation.lock
# Replace the value below with the recorded PID and inspect the process.
Get-Process -Id 12345 -ErrorAction SilentlyContinue
# Run only after confirming no token script is running:
Remove-Item -LiteralPath .state/operation.lock
```

Preserve the wallet, journal, and any `.tmp` state file. A write interrupted before the atomic rename cannot have triggered a new broadcast from that preparation; the previous committed journal remains authoritative. Do not promote or delete temporary state without review.

## Expiry, failures, or unavailable transaction history

These conditions deliberately stop automatic sending. A null RPC transaction status is not sufficient proof that nothing happened. Read the saved signature in the local JSON and inspect `https://explorer.solana.com/tx/SIGNATURE?cluster=devnet`. Compare finalized transaction history, mint supply, and both relevant token accounts. RPC history can be unavailable or pruned; retain the journal and seek archival evidence if needed.

If a transaction finalized successfully, retain its entry and retry verification once the RPC can serve its history. If it definitively failed, instructions rolled back but fees may have been charged. If it expired without landing, a replacement may be possible only after proving expiry and nonexecution with reliable finalized history and state. Replacements are intentionally not automated in this phase. Review and implement a targeted recovery with the mentor instead of deleting state or rerunning with new keys. The mint initialization transaction also requires the mint account's signer, whose secret is intentionally not persisted; rebuilding a definitively unexecuted initialization will need a new mint.

If local state is lost after a broadcast, automatic duplicate protection cannot be guaranteed. Restore a private backup and reconcile it against Devnet before executing anything. Devnet itself may reset; reset state only as part of a reviewed fresh project run with new evidence.
