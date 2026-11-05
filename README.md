# Turbin3 Q4 Builders 2026 — Assignment 1

## About this repository

This is my TypeScript implementation of the SPL token and Metaplex Core NFT tasks for the Turbin3 Q4 Builders 2026 cohort. I completed all three mandatory tasks on Solana Devnet: SPL token creation and transfer, Core NFT creation, and the NFT name and metadata URI update. The read-only verification script independently reported both NFT transactions as finalized.

## What I built

I created a mint with 9 decimals, minted 1,000 tokens to my development wallet, and transferred 10 tokens to another wallet. After the transfer, I verified a sender balance of 990, a recipient balance of 10, and a total supply of 1,000.

For the NFT task, I created a standalone Metaplex Core asset named **Turbin3 Devnet Gull**, then updated its name to **Turbin3 Devnet Gull Evolved** and changed its metadata URI. The same development wallet remained the owner and update authority. I kept the NFT journal separate from the SPL work. I intentionally skipped the optional NFT ownership transfer and burn challenges.

Wallet, SPL, and NFT scripts live in `src/wallet/`, `src/spl-token/`, and `src/mpl-core/`. Shared SPL configuration and recovery code are in `src/lib/`, metadata files in `metadata/`, and offline tests in `tests/`. Local wallet files and journals stay in ignored `wallets/` and `.state/` directories.

## Tools and dependencies

I used Node.js 22.19.0, npm 10.9.3, TypeScript 5.9.3, tsx 4.23.15, and dotenv 18.0.9, with these installed Solana dependencies:

| Package | Version |
| --- | --- |
| `@solana/web3.js` | 1.99.0 |
| `@solana/spl-token` | 0.4.15 |
| `@metaplex-foundation/mpl-core` | 1.10.0 |
| `@metaplex-foundation/umi` | 1.6.0 |
| `@metaplex-foundation/umi-bundle-defaults` | 1.6.0 |
| `@metaplex-foundation/umi-web3js-adapters` | 1.6.0 |

I used `fromWeb3JsKeypair` and `createSignerFromKeypair` to adapt the existing Web3.js wallet to Umi. The adapter was already installed transitively and is now a direct dependency. No Solana CLI, SPL CLI, Rust build, frontend, or uploader is required. My API references were the [Umi Web3.js adapters](https://www.metaplex.com/docs/dev-tools/umi/web3js-differences-and-adapters), [Core JavaScript SDK](https://www.metaplex.com/docs/smart-contracts/core/sdk/javascript), [SPL token basics](https://solana.com/docs/tokens/basics), and [minting instructions](https://solana.com/docs/tokens/basics/mint-tokens).

## Getting started

These commands use PowerShell. I use `npm.cmd` because Windows blocks `npm.ps1` under the current execution policy; no policy change is needed.

```powershell
Set-Location 'C:\Users\hp\Desktop\turbin3-q4-2026-assignment-1'
```

Dependencies are already installed here. On a fresh checkout, restore them with `npm.cmd ci`. Only copy the environment example if `.env` does not already exist:

```powershell
Copy-Item .env.example .env
```

The only accepted settings are `SOLANA_NETWORK=devnet` and `SOLANA_RPC_URL=https://api.devnet.solana.com`. Missing values use those defaults. Each RPC client verifies the Devnet genesis hash. Reads and confirmations use finalized commitment, and wallet/state paths are relative to the project.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd audit
```

These checks do not submit transactions. Typechecking passed, and 26 offline tests passed through the Node fallback below. `npm.cmd test` hit the Windows launcher issue. The earlier audit attempt could not reach npm's security endpoint, so I have no completed audit result to report. Do not use `npm audit fix --force`.

My development wallet already exists. **Do not recreate it or rerun the completed SPL operations in this workspace.** For a separate fresh setup, the command is:

```powershell
npm.cmd run wallet:create
```

It generates a keypair, exclusively creates `wallets/devnet-wallet.json`, and prints only the public address. Before writing the key, it restricts Windows ACLs to the current user's SID or uses mode `0600` on POSIX. ACL setup failure stops creation. Administrators and privileged backup tools may still access it. Keep an encrypted backup outside Git; losing the wallet loses signing access.

To fund the wallet, select **Devnet** in Phantom, check the destination, and use its normal send flow. Never export a Phantom seed phrase or private key. The scripts do not request airdrops. A balance such as 0.05 Devnet SOL is a starting buffer, not a fixed cost; scripts estimate rent and fees and reject insufficient funds.

```powershell
npm.cmd run wallet:balance
```

This read-only command reports the public address, SOL, lamports, and Explorer link.

## SPL token: creation, minting, and transfer

I used the original SPL Token Program, with my development wallet as fee payer and mint authority, and no freeze authority. I did not add a token display name, symbol, image, or metadata account; the mint address identifies the token.

These are the commands for the completed creation and issuance steps, retained for reproduction in a separate fresh setup:

```powershell
npm.cmd run token:create
npm.cmd run token:mint
npm.cmd run token:verify
```

Creation initializes a mint with zero supply. Minting creates my associated token account (ATA) if needed and issues exactly `1_000_000_000_000n` base units in one transaction. The script checks finalized supply and the token balance delta. I retained mint authority, so supply is not cryptographically capped; the local journal prevents accidental repeat issuance.

The transfer command takes another wallet's public address. Its private key is never needed:

```powershell
$recipient = 'REPLACE_WITH_RECIPIENT_PUBLIC_ADDRESS'
npm.cmd run token:transfer -- $recipient
npm.cmd run token:verify -- $recipient
```

It transfers exactly `10_000_000_000n` base units using `TransferChecked`, creating the recipient ATA in the same transaction if necessary. My wallet pays its rent. Address validation rejects invalid, self, and off-curve addresses such as PDAs; I still need to check who controls the destination.

The journal allows one assignment transfer and rejects a changed recipient after preparation. Reruns resolve the recorded operation instead of creating another transfer. Read-only verification can use the saved recipient or an explicit address:

```powershell
npm.cmd run token:verify
npm.cmd run token:verify -- $recipient
```

Verification reports supply, ATA balances, historical transfer deltas, transaction statuses, and Explorer links. Balances cover each owner's ATA for this mint, not every possible token account. A missing ATA is reported as zero; malformed accounts, wrong owners, and RPC failures are errors. Separate finalized reads are not a single atomic snapshot.

## MPL Core NFT: creation and metadata update

I used Core `create()` with the existing wallet explicitly set as owner and update authority. Before calling `update()`, the script checked that the wallet was the direct `Address` update authority, then changed the name and URI together. After finalization, the scripts fetched and verified the asset address, Core program owner, wallet owner, update authority, name, and URI. I also ran the read-only verification script, which independently reported both transactions as finalized on Devnet.

`metadata/original.json` and `metadata/updated.json` contain distinct names, descriptions, attributes, and a real HTTPS image URL. Both reference the [Western Gull photograph by Dschwen](https://commons.wikimedia.org/wiki/File:Gull_portrait_ca_usa.jpg), with attribution and a CC BY 2.5 license link. The updated document is hosted on GitHub Pages at [metadata/updated.json](https://kblaq1178.github.io/turbin3-q4-2026-assignment-1/metadata/updated.json), and that URL is now recorded on-chain. Local paths are not public metadata URLs.

For reproduction in a separate fresh setup, host both JSON files at distinct stable HTTPS URLs before minting. The existing Wikimedia image can be retained, or a copy can be hosted with attribution preserved. If its URL changes, edit both local documents before uploading. Upload a replacement image first, then the JSON files; do not overwrite the original metadata. The [NFT guide](docs/mpl-core.md) covers hosting and recovery; its implementation-stage pending-execution notes predate the completed transactions recorded here.

The validator checks both JSON URLs and both image responses before creation. It requires public HTTPS GETs without authentication or redirects, appropriate content types, and image file signatures. Hosted JSON must match the local files. It pins content hashes for the update. Limits are 32 UTF-8 bytes per name, 200 bytes per metadata URI, 100 KB per JSON response, and 10 MB per image. Expiring links and preview pages are unsuitable.

For a fresh setup, set the actual hosted URLs and validate them:

```powershell
$env:SOLANA_NETWORK = 'devnet'
$env:SOLANA_RPC_URL = 'https://api.devnet.solana.com'
$env:NFT_ORIGINAL_URI = Read-Host 'Public HTTPS URL for original.json'
$env:NFT_UPDATED_URI = Read-Host 'Public HTTPS URL for updated.json'
npm.cmd run nft:validate-metadata
```

That command only performs HTTP GETs. These are the commands for the completed NFT steps, retained for reproduction. Creation and update submit transactions in a fresh setup; `nft:verify` is read-only. Preserve this workspace's completed journal rather than starting another asset:

```powershell
npm.cmd run nft:create
npm.cmd run nft:verify
npm.cmd run nft:update
npm.cmd run nft:verify
```

Verification reports the current owner, update authority, name, URI, asset address, transaction statuses, and Explorer links. NFT state goes into `.state/mpl-core-devnet.json`, leaving SPL state separate. Rerunning creation or update checks the saved transaction without rebroadcasting or preparing a replacement. Unknown, pending, expired, or failed outcomes stop for review. See [NFT recovery instructions](docs/mpl-core.md).

## Transaction evidence

The SPL values below come from my existing Phase 1 journal. All three SPL transactions are recorded as finalized, with verification timestamps on **2026-11-05 UTC**. Both NFT transactions were also independently reported as finalized by the read-only verification script. This documentation update did not rerun operations or perform a fresh live RPC check.

| Account | Public address / Devnet Explorer |
| --- | --- |
| Development wallet | [BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT](https://explorer.solana.com/address/BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT?cluster=devnet) |
| Recipient wallet | [BA1p3kVRP8zRw8qFnLRcE46M2bnsFpZsyhZ3ppFwmmUK](https://explorer.solana.com/address/BA1p3kVRP8zRw8qFnLRcE46M2bnsFpZsyhZ3ppFwmmUK?cluster=devnet) |
| Token mint | [7KSFsfZN4PTGLHsmKVbjRGDiBZmKLFTki2o6DBECwib](https://explorer.solana.com/address/7KSFsfZN4PTGLHsmKVbjRGDiBZmKLFTki2o6DBECwib?cluster=devnet) |

| Operation | Signature / Devnet Explorer | Finalized slot |
| --- | --- | --- |
| Create mint | [iK3MLoUbP8oRZLeq7wS5LGbS2nTutzdNhe2sNPTkvtt7MseZScVXERgmALZpZvKPBMSVWrka2qVVY74dm1efxgq](https://explorer.solana.com/tx/iK3MLoUbP8oRZLeq7wS5LGbS2nTutzdNhe2sNPTkvtt7MseZScVXERgmALZpZvKPBMSVWrka2qVVY74dm1efxgq?cluster=devnet) | 518861067 |
| Mint 1,000 tokens | [45B81r78vyh2w9u8RQ8A6rDYDHYV3AUsCLp7VKVxp7yA3Xn5XqheHREgiL9fP9BtPJnSFzbbHhuPijVpgGqUqc43](https://explorer.solana.com/tx/45B81r78vyh2w9u8RQ8A6rDYDHYV3AUsCLp7VKVxp7yA3Xn5XqheHREgiL9fP9BtPJnSFzbbHhuPijVpgGqUqc43?cluster=devnet) | 518861419 |
| Transfer 10 tokens | [3vXHye5y8JR7kX2NhnmCBJY18U9p8XL4iJr9WQFAoL2QfWuSS6EFHKRKjfw7j28HJYJpSeTiyALeVyoajybYuPH5](https://explorer.solana.com/tx/3vXHye5y8JR7kX2NhnmCBJY18U9p8XL4iJr9WQFAoL2QfWuSS6EFHKRKjfw7j28HJYJpSeTiyALeVyoajybYuPH5?cluster=devnet) | 518862717 |

The saved SPL evidence records 9 decimals, a supply of 1,000 after issuance, and balances of 990 and 10 after transfer.

| NFT field | Verified value |
| --- | --- |
| Asset | [2HinZ3FejE6EQeJ4XRPDCzQttrZUneUd9cMv9Udz6YqA](https://explorer.solana.com/address/2HinZ3FejE6EQeJ4XRPDCzQttrZUneUd9cMv9Udz6YqA?cluster=devnet) |
| Original name | Turbin3 Devnet Gull |
| Updated name | Turbin3 Devnet Gull Evolved |
| Updated metadata URI | [updated.json](https://kblaq1178.github.io/turbin3-q4-2026-assignment-1/metadata/updated.json) |
| Owner and update authority | [BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT](https://explorer.solana.com/address/BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT?cluster=devnet) |

| NFT operation | Signature / Devnet Explorer | Status |
| --- | --- | --- |
| Create asset | [3inheUJ3ESDJDqXdN4VeYsjeguDimkBDfG55BihexHcPnqs5vEHQCNxvTgH87kKX1bw5zyS4igQKnZJgQGoWTKGx](https://explorer.solana.com/tx/3inheUJ3ESDJDqXdN4VeYsjeguDimkBDfG55BihexHcPnqs5vEHQCNxvTgH87kKX1bw5zyS4igQKnZJgQGoWTKGx?cluster=devnet) | Finalized |
| Update name and URI | [5DnW1aZuR1yNUXquBSQam46UkHuobmzEJFU9FT4NmCxVZpFyqzK35gXXBV7cM4tQNa6gqq4SM4iNcypU3BkCyLM7](https://explorer.solana.com/tx/5DnW1aZuR1yNUXquBSQam46UkHuobmzEJFU9FT4NmCxVZpFyqzK35gXXBV7cM4tQNa6gqq4SM4iNcypU3BkCyLM7?cluster=devnet) | Finalized |

The full public record is in [transaction evidence](docs/transaction-evidence.md). All three mandatory tasks are complete; optional NFT transfer and burn were intentionally skipped.

## What I learned

Working with 9 decimals meant keeping token amounts in exact base units. I used `bigint` for issuance and transfer, then checked balance changes alongside total supply. Creating ATAs within those transactions also meant accounting for their rent before sending.

The recovery code made me distinguish a failed request from a failed transaction. I save signed bytes and signatures before broadcasting, then check the recorded signature during recovery. Offline tests exercise those branches; live verification separately confirmed the NFT transactions and updated asset fields on Devnet.

## Notes and limitations

The test run emitted `bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)`. The dependency used its JavaScript fallback and the tests passed; this was not a transaction failure. The managed Windows environment also caused tsx to fail with `uv_os_get_passwd` / `ENOMEM`. I compiled the tests and ran them with Node instead: **26/26 passed**, including 16 Core tests and 10 SPL tests with deterministic fixtures and in-memory RPC fakes.

```powershell
node node_modules/typescript/bin/tsc --noEmit false --outDir dist/phase2-check
New-Item -ItemType Directory -Force dist/phase2-check/metadata | Out-Null
Copy-Item metadata/original.json,metadata/updated.json dist/phase2-check/metadata/
node --test dist/phase2-check/tests/*.test.js
```

Use that output directory only for offline tests; its module-relative wallet/state paths differ from the source project. Run actual operations through npm/tsx in a normal user shell. Strict project typechecking passed with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled. `skipLibCheck` handles the Umi 1.6.0 declaration errors documented in the [NFT validation notes](docs/mpl-core.md). No installed package was patched. The managed session could not read the wallet because of its ACL, and permissions were left untouched. [Phase 1 validation notes](docs/validation.md) remain a historical record.

Keep `wallets/`, `.env`, `.state/`, private keys, seed phrases, and signed transaction bytes out of Git and public evidence. Signed bytes can be broadcast while valid. `.gitignore` covers local state and common key export names but does not remove already tracked secrets; inspect staged files before committing. Publish only public addresses, signatures, and verified balances. A hosting provider never needs this development wallet's private key.

Both workflows save journals before sending and use exclusive locks. SPL recovery may replay identical signed bytes while valid; NFT recovery never rebroadcasts. Timeouts are not proof of failure, and failed transactions may still charge fees. Never delete a journal, regenerate a wallet, or replace signed bytes to bypass a guard. Preserve temporary state files too. Remove a stale lock only after confirming no corresponding script is running, following [SPL recovery](docs/recovery.md) or [NFT recovery](docs/mpl-core.md). Keep encrypted backups: lost state, external authority use, compromised keys, filesystem failures, and Devnet resets can defeat local protections.

Public URL checks prove current reachability, not permanent hosting. The updated metadata is served through GitHub Pages, so that URL depends on the repository and Pages hosting remaining available. All mandatory Devnet tasks are complete; I intentionally skipped optional NFT transfer and burn. This documentation update did not push to GitHub. The [social article](docs/social-article-draft.md) is still a draft and needs the completed execution results before publication.
