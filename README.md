# Turbin3 Q4 Builders 2026 — Assignment 1

TypeScript command-line implementation of Assignment 1 on Solana Devnet. Task 1 (SPL creation, minting and transfer) is completed and verified; preserve its wallet and journal and do not rerun token operations. Tasks 2 and 3 (standalone Metaplex Core NFT creation and name/URI update) are implemented for manual execution. No NFT transaction has been submitted during implementation. See [NFT hosting, commands, validation and recovery](docs/mpl-core.md).

The assignment explores fungible tokens and Metaplex Core assets: create and distribute an SPL token, create an NFT, then change its name and metadata as update authority. NFT ownership transfer and burning with eligible rent recovery are optional extensions.

## Technologies

Node.js 22.19.0, npm 10.9.3, TypeScript 5.9.3, tsx 4.23.15, `@solana/web3.js` 1.99.0, `@solana/spl-token` 0.4.15, and dotenv 18.0.9. NFT scripts use MPL Core 1.10.0, Umi 1.6.0, Umi defaults 1.6.0, and Umi Web3 adapters 1.6.0 (now declared directly; already installed). No Solana CLI, SPL CLI, frontend, Rust build, or uploader is required.

The token uses the original SPL Token Program, nine decimals, the development wallet as fee payer and mint authority, and no freeze authority. This phase does not add a token display name, symbol, image, or metadata account. The mint address uniquely identifies the token.

## Project layout

```text
src/
  wallet/       # create-wallet.ts, load-wallet.ts, balance.ts
  lib/          # configuration, Devnet connection, state, transaction journal
  spl-token/    # create-token.ts, mint-token.ts, transfer-token.ts, verify.ts, shared.ts
  mpl-core/     # create, update, verify, metadata validation, separate NFT journal
metadata/       # original.json and updated.json; upload manually before NFT creation
docs/           # recovery, validation, evidence, and social article draft
tests/          # offline safety checks
wallets/        # ignored; created locally, never committed
.state/         # ignored; created by commands, contains recovery journal
```

## Setup and local checks

Use PowerShell from the project directory. `npm.cmd` avoids the Windows policy that blocks `npm.ps1`; no execution-policy change is needed.

```powershell
Set-Location 'C:\Users\hp\Desktop\turbin3-q4-2026-assignment-1'
Copy-Item .env.example .env
npm.cmd run typecheck
npm.cmd test
npm.cmd audit
```

Copy the example only if `.env` does not already exist. Dependencies are already installed here; do not reinstall them during review. A fresh checkout on another machine can use `npm.cmd ci` to restore the lockfile.

`SOLANA_NETWORK=devnet` and `SOLANA_RPC_URL=https://api.devnet.solana.com` are the only accepted configuration. Missing variables use those defaults. Every RPC entry point checks the Devnet genesis hash before proceeding, and uses finalized commitment. Wallet/state locations are fixed relative to the project, independent of the current directory.

No setup, install, typecheck, or test command broadcasts a transaction. The commands below are manual execution instructions for after code review.

## Create and fund the development wallet

```powershell
npm.cmd run wallet:create
```

The script uses `Keypair.generate()`, saves a 64-byte JSON keypair in `wallets/devnet-wallet.json`, and prints only its public address. Exclusive file creation prevents overwriting an existing wallet. On Windows it removes inherited file ACLs and grants the current user's SID full control before writing any key material; failure to apply that restriction stops creation. On POSIX it applies mode `0600`. Windows administrators and privileged backup software may still access local files. Keep an encrypted backup outside Git if needed; losing this file loses signing access.

In Phantom, select **Devnet**, send Devnet SOL to the printed public address, and check the destination carefully. Use Phantom's normal send flow; never export its seed phrase or private key. A small Devnet balance such as 0.05 SOL is a practical starting buffer, but scripts calculate rent and fees dynamically and report insufficient funding. This project does not request airdrops.

```powershell
npm.cmd run wallet:balance
```

This command is read-only and reports the public address, SOL, lamports, and Devnet Explorer link.

## Create the token mint and issue the first supply

These are two distinct transactions: first create a mint account with zero supply, then issue exactly 1,000 tokens.

```powershell
npm.cmd run token:create
npm.cmd run token:mint
npm.cmd run token:verify
```

`token:create` atomically creates and initializes a mint with nine decimals and records its address. It prints the mint address, transaction signature, and Explorer URLs. `token:mint` creates the owner's associated token account (ATA) if needed and mints exactly `1_000_000_000_000n` base units in one transaction. Both use the local development wallet to pay fees; it also signs as mint authority.

After finalization, the script checks the mint supply and the owner's token delta from transaction metadata. Expected initial supply and sender balance are both **1,000 tokens**. Authority is retained for the assignment; supply is not cryptographically capped. The script's guard prevents accidental issuance a second time, and rejects an existing nonzero supply when no mint operation is recorded.

## Transfer exactly 10 tokens

Supply a different wallet's public address, such as a separate Devnet receiving account in Phantom. Recipient private keys are never needed.

```powershell
$recipient = 'REPLACE_WITH_RECIPIENT_PUBLIC_ADDRESS'
npm.cmd run token:transfer -- $recipient
npm.cmd run token:verify -- $recipient
```

Address validation rejects invalid addresses, the sender, and off-curve addresses such as PDAs. This is a wallet-to-wallet assignment flow. It cannot determine whether a valid address is actually controlled by the intended person; verify it yourself.

The transaction creates the recipient ATA if needed and transfers exactly `10_000_000_000n` base units using `TransferChecked`. The sender pays recipient ATA rent when necessary. Verification checks historical sender and recipient deltas of **−10** and **+10**, then displays current balances. Without unrelated activity, sender = **990**, recipient = **10**, total supply = **1,000**.

One assignment transfer is allowed. Repeating the command resumes or verifies the original transaction; it does not send another 10 tokens. Changing the recipient after preparation is rejected. See [recovery instructions](docs/recovery.md) for ambiguous or failed transactions.

## Verification and transaction evidence

```powershell
npm.cmd run token:verify
npm.cmd run token:verify -- $recipient
```

Verification is read-only. It reports the network, wallet, mint, decimals, supply, sender ATA balance, optional recipient ATA balance, operation status, live transaction status when available, and Explorer links. Without an explicit recipient it uses the recorded transfer recipient. Balances cover each owner's ATA for this mint, not every possible token account they might own. RPC reads are finalized but are separate requests, not a single atomic snapshot.

The local journal `.state/devnet.json` binds the wallet and network to the mint and operations. It stores signed transaction bytes and signatures before broadcasting, then finalized slots, first successful verification timestamps, and evidence. It never stores keypair secrets. First verification evidence is preserved on reruns; console output reflects current balances. Do not publish the journal: signed transactions are broadcastable while valid. Copy only public addresses, signatures, and verified balances to [docs/transaction-evidence.md](docs/transaction-evidence.md).

| Evidence | Status |
| --- | --- |
| Development public address | Existing local wallet; preserved |
| Token mint address | Recorded in existing Phase 1 journal |
| Mint creation signature / link | Completed; retain existing evidence |
| 1,000-token issuance signature / link | Completed; retain existing evidence |
| 10-token transfer signature / link | Completed; retain existing evidence |
| Final supply and balances | Verified on Devnet in Phase 1 |

## Reliability and security

- Keep `wallets/`, `.env`, and `.state/` private. `.gitignore` also covers common keypair export names. Inspect staged files before the future GitHub submission; ignore rules do not remove already tracked secrets.
- No Phantom secret is ever needed. Use only Devnet SOL and verify Phantom's selected network before funding.
- ATA creation and minting/transfer happen atomically. Amounts use `bigint`, and checked instructions validate decimals.
- The journal is saved before sending. Reruns check transaction history and only replay identical signed bytes, which have the same signature. A global exclusive state lock prevents simultaneous operations.
- RPC timeouts are not proof of failure. Preserve state. Expired, failed, or uncertain transactions stop for manual review rather than create replacements. Never delete the journal just to bypass a guard.
- A missing ATA is reported as zero; RPC errors, wrong owners, and malformed accounts are errors. Solana transactions that fail may still charge a fee.
- Filesystem permissions and local guards reduce accidental exposure/repetition; they cannot protect a compromised account, lost state, or deliberate external use of the mint authority.

## Lessons learned

Token ownership is recorded in token accounts rather than in a wallet's SOL balance. ATAs provide predictable default accounts, but creating them requires rent. A mint's decimal precision converts human amounts to exact integer base units: 1,000 tokens at nine decimals is 1,000 × 10⁹ units. Minting changes supply; transfers move balances while preserving supply.

Reliable blockchain scripts must account for ambiguous network outcomes. An RPC timeout can follow a successful submission, so transaction signatures and durable state matter as much as the token instructions. This phase implements those safeguards; Devnet execution lessons will be added after the manual run.

Potential applications include community rewards, loyalty points, in-game currencies, and test distributions. Production use would require an authority policy, operational controls, and broader testing beyond this assignment.

## Assignment and submission checklist

- [x] **1. Mint and transfer a custom SPL token** — completed and verified on Devnet.
- [ ] **2. Mint an NFT with Metaplex Core** — implemented and tested; metadata hosting and manual execution pending.
- [ ] **3. Update NFT name and metadata as update authority** — implemented and tested; manual execution pending.
- [ ] **4. Transfer NFT ownership** (optional) — pending later phase.
- [ ] **5. Burn NFT and recover eligible rent** (optional) — pending later phase.
- [ ] GitHub repository submission — documentation prepared; no repository initialization, push, or deployment performed.
- [ ] Social article/thread/tutorial — [draft prepared](docs/social-article-draft.md); execution results and publication pending.

See [validation findings](docs/validation.md) for package compatibility, checks, and outstanding environment limitations. The implementation follows Solana's official [token creation and account concepts](https://solana.com/docs/tokens/basics) and [checked minting instructions](https://solana.com/docs/tokens/basics/mint-tokens).
